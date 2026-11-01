export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      if (!env.ALVIS_KV) {
        return Response.json({
          ok: false,
          message: "ALVIS_KV binding not found"
        }, { status: 500 });
      }

      return Response.json({
        ok: true,
        worker: "ALVIS-SYNC",
        kv: "connected"
      });
    }

    return Response.json({
      name: "ALVIS-SYNC",
      status: "ready"
    });
  }
};