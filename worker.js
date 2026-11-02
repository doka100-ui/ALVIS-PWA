function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function verifyToken(request, env) {
  const secret = env.ALVIS_SYNC_TOKEN;

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("Authorization") || "";
  const expected = `Bearer ${secret}`;

  if (authorization.length !== expected.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < expected.length; i++) {
    difference |= authorization.charCodeAt(i) ^ expected.charCodeAt(i);
  }

  return difference === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 公開ヘルスチェック。秘密情報は返さない
    if (url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        worker: "ALVIS-SYNC",
        kv: env.ALVIS_KV ? "connected" : "not connected"
      }, env.ALVIS_KV ? 200 : 500);
    }

    // 認証テスト
    if (url.pathname === "/auth-check") {
      if (!env.ALVIS_SYNC_TOKEN) {
        return jsonResponse({
          ok: false,
          message: "Server secret is not configured"
        }, 500);
      }

      if (!verifyToken(request, env)) {
        return jsonResponse({
          ok: false,
          message: "Unauthorized"
        }, 401);
      }

      return jsonResponse({
        ok: true,
        message: "ALVIS authentication successful"
      });
    }

    return jsonResponse({
      ok: false,
      message: "Not found"
    }, 404);
  }
};