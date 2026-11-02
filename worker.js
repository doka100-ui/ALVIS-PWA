const ALLOWED_ORIGIN = "https://alvis-pwa.pages.dev";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse({
        ok: true,
        worker: "ALVIS-SYNC",
        kv: env.ALVIS_KV ? "connected" : "not connected"
      }, env.ALVIS_KV ? 200 : 500, origin);
    }

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

    return jsonResponse({
      ok: false,
      message: "Not found"
    }, 404, origin);
  }
};