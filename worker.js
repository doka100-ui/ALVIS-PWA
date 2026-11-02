
function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" &&
      (url.hostname === "alvis-pwa.pages.dev" ||
       url.hostname.endsWith(".alvis-pwa.pages.dev"));
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
  return !!record &&
    typeof record === "object" &&
    record.version === 1 &&
    Array.isArray(record.salt) &&
    record.salt.length === 16 &&
    record.salt.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    Array.isArray(record.iv) &&
    record.iv.length === 12 &&
    record.iv.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    Array.isArray(record.encrypted) &&
    record.encrypted.length >= 16 &&
    record.encrypted.length <= 1500000 &&
    record.encrypted.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
}

async function saveData(request, env, origin, storageKey) {
  if (!verifyToken(request, env)) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401, origin);
  }

  if (!env.ALVIS_KV) {
    return jsonResponse({ ok: false, message: "KV unavailable" }, 500, origin);
  }

  let raw;

  try {
    raw = await request.text();
  } catch {
    return jsonResponse({ ok: false, message: "Unable to read request" }, 400, origin);
  }

  if (raw.length > 2000000) {
    return jsonResponse({ ok: false, message: "Payload too large" }, 413, origin);
  }

  let body;

  try {
    body = JSON.parse(raw);
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

  const currentRaw = await env.ALVIS_KV.get(storageKey);
  let currentRevision = 0;

  if (currentRaw) {
    try {
      const current = JSON.parse(currentRaw);

      if (
        current.version !== 1 ||
        !Number.isInteger(current.revision) ||
        current.revision < 1 ||
        !validEncryptedRecord(current.encryptedRecord)
      ) {
        throw new Error("Invalid stored data");
      }

      currentRevision = current.revision;
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

  if (payload.length > 2000000) {
    return jsonResponse({ ok: false, message: "Payload too large" }, 413, origin);
  }

  await env.ALVIS_KV.put(storageKey, payload);

  return jsonResponse({
    ok: true,
    message: "Encrypted data saved",
    revision: nextRevision
  }, 200, origin);
}

async function loadData(request, env, origin, storageKey) {
  if (!verifyToken(request, env)) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401, origin);
  }

  if (!env.ALVIS_KV) {
    return jsonResponse({ ok: false, message: "KV unavailable" }, 500, origin);
  }

  const saved = await env.ALVIS_KV.get(storageKey);

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
      throw new Error("Invalid stored data");
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

async function forwardToDO(request, env, origin, instanceName) {
  if (!verifyToken(request, env)) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401, origin);
  }

  if (!env.ALVIS_TEST_DO) {
    return jsonResponse(
      { ok: false, message: "Durable Object binding unavailable" },
      500,
      origin
    );
  }

  const id = env.ALVIS_TEST_DO.idFromName(instanceName);
  const stub = env.ALVIS_TEST_DO.get(id);
  const url = new URL(request.url);

  let doResponse;

  if (url.pathname.endsWith("-load") && request.method === "GET") {
    doResponse = await stub.fetch("https://alvis-do/load");
  } else if (url.pathname.endsWith("-save") && request.method === "POST") {
    let raw;

    try {
      raw = await request.text();
    } catch {
      return jsonResponse({ ok: false, message: "Unable to read request" }, 400, origin);
    }

    if (raw.length > 2000000) {
      return jsonResponse({ ok: false, message: "Payload too large" }, 413, origin);
    }

    doResponse = await stub.fetch("https://alvis-do/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw
    });
  } else {
    return jsonResponse(
      { ok: false, message: "Method not allowed" },
      405,
      origin
    );
  }

  const headers = new Headers(doResponse.headers);

  for (const [name, value] of Object.entries(corsHeaders(origin))) {
    headers.set(name, value);
  }

  return new Response(doResponse.body, {
    status: doResponse.status,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (origin && !isAllowedOrigin(origin)) {
      return jsonResponse({ ok: false, message: "Origin not allowed" }, 403, origin);
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse({
        ok: true,
        worker: "ALVIS-SYNC",
        kv: env.ALVIS_KV ? "connected" : "not connected",
        durableObject: env.ALVIS_TEST_DO ? "connected" : "not connected",
        productionStorage: "durable-object-isolated"
      }, 200, origin);
    }

    if (url.pathname === "/auth-check" && request.method === "GET") {
      if (!env.ALVIS_SYNC_TOKEN) {
        return jsonResponse({
          ok: false,
          message: "Server secret is not configured"
        }, 500, origin);
      }

      if (!verifyToken(request, env)) {
        return jsonResponse({ ok: false, message: "Unauthorized" }, 401, origin);
      }

      return jsonResponse({
        ok: true,
        message: "ALVIS authentication successful"
      }, 200, origin);
    }

    // 本番用Durable Object。テスト領域とは完全に分離。
    if (
      url.pathname === "/sync/main-save" ||
      url.pathname === "/sync/main-load"
    ) {
      return forwardToDO(request, env, origin, "alvis-main");
    }

    // テスト用Durable Object
    if (
      url.pathname === "/sync/do-test-save" ||
      url.pathname === "/sync/do-test-load"
    ) {
      return forwardToDO(request, env, origin, "alvis-test");
    }

    // 既存の本番KV領域。移行確認まで維持する。
    if (url.pathname === "/sync/save" && request.method === "POST") {
      return saveData(request, env, origin, "alvis:shared-memory");
    }

    if (url.pathname === "/sync/load" && request.method === "GET") {
      return loadData(request, env, origin, "alvis:shared-memory");
    }

    // 既存のKVテスト領域
    if (url.pathname === "/sync/test-save" && request.method === "POST") {
      return saveData(request, env, origin, "alvis:test:shared-memory");
    }

    if (url.pathname === "/sync/test-load" && request.method === "GET") {
      return loadData(request, env, origin, "alvis:test:shared-memory");
    }

    return jsonResponse({
      ok: false,
      message: "Not found"
    }, 404, origin);
  }
};

export class ALVISSyncObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision INTEGER NOT NULL,
        payload TEXT NOT NULL
      )
    `);
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/load" && request.method === "GET") {
      const rows = this.sql.exec(
        "SELECT revision, payload FROM sync_state WHERE id = 1"
      ).toArray();

      if (rows.length === 0) {
        return Response.json({
          ok: true,
          exists: false,
          revision: 0
        });
      }

      const row = rows[0];

      return Response.json({
        ok: true,
        exists: true,
        revision: row.revision,
        data: JSON.parse(row.payload)
      });
    }

    if (url.pathname === "/save" && request.method === "POST") {
      let body;

      try {
        body = await request.json();
      } catch {
        return Response.json({
          ok: false,
          message: "Invalid JSON"
        }, { status: 400 });
      }

      if (
        !body ||
        body.version !== 1 ||
        !Number.isInteger(body.expectedRevision) ||
        body.expectedRevision < 0 ||
        !validEncryptedRecord(body.encryptedRecord)
      ) {
        return Response.json({
          ok: false,
          message: "Invalid encrypted record or revision"
        }, { status: 400 });
      }

      const result = this.ctx.storage.transactionSync(() => {
        const rows = this.sql.exec(
          "SELECT revision FROM sync_state WHERE id = 1"
        ).toArray();

        const currentRevision =
          rows.length === 0 ? 0 : rows[0].revision;

        if (body.expectedRevision !== currentRevision) {
          return {
            conflict: true,
            currentRevision
          };
        }

        const nextRevision = currentRevision + 1;

        const payload = JSON.stringify({
          version: 1,
          encryptedRecord: body.encryptedRecord
        });

        this.sql.exec(
          `INSERT INTO sync_state (id, revision, payload)
           VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             revision = excluded.revision,
             payload = excluded.payload`,
          nextRevision,
          payload
        );

        return {
          conflict: false,
          revision: nextRevision
        };
      });

      if (result.conflict) {
        return Response.json({
          ok: false,
          message: "Revision conflict",
          currentRevision: result.currentRevision
        }, { status: 409 });
      }

      return Response.json({
        ok: true,
        message: "Encrypted data saved",
        revision: result.revision
      });
    }

    return Response.json({
      ok: false,
      message: "Not found"
    }, { status: 404 });
  }
}
