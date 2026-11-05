const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://alvis-pwa.pages.dev",
  "https://development.alvis-pwa.pages.dev"
]);

function allowedOrigins(env) {
  const extra = String(env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = allowedOrigins(env);
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  if (allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function callOpenAI(question, env) {
  const base = String(env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = String(env.OPENAI_MODEL || "");
  const response = await fetch(base + "/responses", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: "あなたは独立した論理分析担当AIです。質問に直接答え、重要な根拠・前提・不確実性を簡潔に示してください。指示が曖昧なら仮定を明示してください。",
      input: question,
      store: false,
      max_output_tokens: 700
    }),
    signal: AbortSignal.timeout(24000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("OpenAI upstream HTTP " + response.status);
  const text = (body.output || [])
    .filter(item => item.type === "message")
    .flatMap(item => item.content || [])
    .filter(part => part.type === "output_text" && typeof part.text === "string")
    .map(part => part.text)
    .join("\n").trim() || String(body.output_text || "").trim();
  if (!text) throw new Error("OpenAI returned an empty response");
  return { provider: "OpenAI", model, text: text.slice(0, 5000) };
}

async function callGemini(question, env) {
  const model = String(env.GEMINI_MODEL || "");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      system_instruction: "あなたは独立した批判的検証担当AIです。質問を別の視点から検討し、見落とし・反例・誤りやすい前提・不確実性を簡潔に示してください。確信がない場合は明示してください。",
      input: question,
      store: false,
      generation_config: { thinking_level: "low", max_output_tokens: 700 }
    }),
    signal: AbortSignal.timeout(24000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Gemini upstream HTTP " + response.status);
  const text = (body.steps || [])
    .filter(step => step.type === "model_output")
    .flatMap(step => step.content || [])
    .filter(part => part.type === "text" && typeof part.text === "string")
    .map(part => part.text)
    .join("\n").trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return { provider: "Gemini", model, text: text.slice(0, 5000) };
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    const origin = request.headers.get("Origin") || "";
    if (origin && !allowedOrigins(env).has(origin)) return json({ error: "Origin not allowed" }, 403, headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        providers: [
          { name: "OpenAI", configured: !!(env.OPENAI_API_KEY && env.OPENAI_MODEL) },
          { name: "Gemini", configured: !!(env.GEMINI_API_KEY && env.GEMINI_MODEL) }
        ]
      }, 200, headers);
    }

    if (request.method !== "POST" || url.pathname !== "/v1/collaborate") {
      return json({ error: "Not found" }, 404, headers);
    }

    const expected = String(env.ALVIS_GATEWAY_TOKEN || "");
    const authorization = request.headers.get("Authorization") || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (expected.length < 32 || !constantTimeEqual(supplied, expected)) {
      return json({ error: "Unauthorized" }, 401, headers);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > 12000) return json({ error: "Request too large" }, 413, headers);
    let rawBody;
    try { rawBody = await request.text(); } catch { return json({ error: "Invalid request body" }, 400, headers); }
    if (rawBody.length > 12000) return json({ error: "Request too large" }, 413, headers);
    let payload;
    try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON" }, 400, headers); }
    const question = typeof payload?.question === "string" ? payload.question.trim() : "";
    if (!question || question.length > 8000) return json({ error: "Question must be 1–8000 characters" }, 400, headers);

    const tasks = [];
    if (env.OPENAI_API_KEY && env.OPENAI_MODEL) tasks.push(callOpenAI(question, env));
    if (env.GEMINI_API_KEY && env.GEMINI_MODEL) tasks.push(callGemini(question, env));
    if (!tasks.length) return json({ error: "No AI provider is configured" }, 503, headers);

    const settled = await Promise.allSettled(tasks);
    const results = settled.filter(item => item.status === "fulfilled").map(item => item.value);
    if (!results.length) return json({ error: "All AI providers failed" }, 502, headers);
    return json({ ok: true, results }, 200, headers);
  }
};
