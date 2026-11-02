
function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      (
        url.hostname === "alvis-pwa.pages.dev" ||
        url.hostname.endsWith(".alvis-pwa.pages.dev")
      )
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };

  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

function verifyToken(request, env) {
  const secret = env.ALVIS_SYNC_TOKEN;
  if (!secret) return false;

  const authorization = request.headers.get("Authorization") || "";
  const expected = `Bearer ${secret}`;

  if (authorization.length !== expected.length) return false;

  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= authorization.charCodeAt(i) ^ expected.charCodeAt(i);
  }

  return difference === 0;
}

function validEncryptedRecord(record) {
  if (!record || typeof record !== "object") return false;

  return (
    record.version === 1 &&
    Array.isArray(record.salt) &&
    record.salt.length === 16 &&
    record.salt.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    Array.isArray(record.iv) &&
    record.iv.length === 12 &&
    record.iv.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    Array.isArray(record.encrypted) &&
    record.encrypted.length >= 16 &&
    record.encrypted.length <= 1_500_000 &&
    record.encrypted.every(n => Number.isInteger(n) && n >= 0 && n <= 255)
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // CORS preflight
    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    // Reject browser requests from unapproved origins.
    // Requests without Origin are allowed for non-browser clients,
    // but still require the secret token on protected endpoints.
    if (origin && !isAllowedOrigin(origin)) {
      return jsonResponse({ ok: false, message: "Origin not allowed" }, 403, origin);
    }

    // Health check
    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse({
        ok: true,
        worker: "ALVIS-SYNC",
        kv: env.ALVIS_KV ? "connected" : "not connected"
      }, env.ALVIS_KV ? 200 : 500, origin);
    }

    // Authentication check
    if (url.pathname === "/auth-check" && request.method === "GET") {
      if (!env.ALVIS_SYNC_TOKEN) {
        return jsonResponse({
          ok: false,
          message: "Server secret is not configured"
        }, 500, origin);
      }

      if (!verifyToken(request, env)) {
        return jsonResponse({
          ok: false,
          message: "Unauthorized"
        }, 401, origin);
      }

      return jsonResponse({
        ok: true,
        message: "ALVIS authentication successful"
      }, 200, origin);
    }

    // Save encrypted data
    if (url.pathname === "/sync/save" && request.method === "POST") {
      if (!verifyToken(request, env)) {
        return jsonResponse({ ok: false, message: "Unauthorized" }, 401, origin);
      }

      if (!env.ALVIS_KV) {
        return jsonResponse({ ok: false, message: "KV unavailable" }, 500, origin);
      }

      const contentLength = Number(request.headers.get("Content-Length") || 0);
      if (contentLength > 2_000_000) {
        return jsonResponse({ ok: false, message: "Payload too large" }, 413, origin);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ ok: false, message: "Invalid JSON" }, 400, origin);
      }

      if (
        !body ||
        body.version !== 1 ||
        !Number.isInteger(body.expectedRevision) ||
        body.expectedRevision < 0 ||
        !validEncryptedRecord(body.encryptedRecord)
      ) {
        return jsonResponse({ ok: false, message: "Invalid encrypted record or revision" }, 400, origin);
      }

      // Read current revision
      const currentRaw = await env.ALVIS_KV.get("alvis:shared-memory");
      let currentRevision = 0;

      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw);
          currentRevision = current.revision;

          if (
            current.version !== 1 ||
            !Number.isInteger(currentRevision) ||
            currentRevision < 1 ||
            !validEncryptedRecord(current.encryptedRecord)
          ) {
            throw new Error("Invalid stored record");
          }
        } catch {
          return jsonResponse({ ok: false, message: "Stored data is invalid" }, 500, origin);
        }
      }

      if (body.expectedRevision !== currentRevision) {
        return jsonResponse({
          ok: false,
          message: "Revision conflict",
          currentRevision
        }, 409, origin);
      }

      const nextRevision = currentRevision + 1;

      const payload = JSON.stringify({
        version: 1,
        revision: nextRevision,
        encryptedRecord: body.encryptedRecord
      });

      if (payload.length > 2_000_000) {
        return jsonResponse({ ok: false, message: "Payload too large" }, 413, origin);
      }

      await env.ALVIS_KV.put("alvis:shared-memory", payload);

      return jsonResponse({
        ok: true,
        message: "Encrypted data saved",
        revision: nextRevision
      }, 200, origin);
    }

    // Load encrypted data
    if (url.pathname === "/sync/load" && request.method === "GET") {
      if (!verifyToken(request, env)) {
        return jsonResponse({ ok: false, message: "Unauthorized" }, 401, origin);
      }

      if (!env.ALVIS_KV) {
        return jsonResponse({ ok: false, message: "KV unavailable" }, 500, origin);
      }

      const saved = await env.ALVIS_KV.get("alvis:shared-memory");

      if (!saved) {
        return jsonResponse({
          ok: true,
          exists: false,
          revision: 0
        }, 200, origin);
      }

      let payload;
      try {
        payload = JSON.parse(saved);

        if (
          payload.version !== 1 ||
          !Number.isInteger(payload.revision) ||
          payload.revision < 1 ||
          !validEncryptedRecord(payload.encryptedRecord)
        ) {
          throw new Error("Invalid stored record");
        }
      } catch {
        return jsonResponse({ ok: false, message: "Stored data is invalid" }, 500, origin);
      }

      return jsonResponse({
        ok: true,
        exists: true,
        revision: payload.revision,
        data: {
          version: 1,
          encryptedRecord: payload.encryptedRecord
        }
      }, 200, origin);
    }

    return jsonResponse({
      ok: false,
      message: "Not found"
    }, 404, origin);
  }
};
