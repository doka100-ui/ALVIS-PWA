# Offline-first policy regression tests

Run with Node.js:

```sh
node tests/offline-first.test.mjs
```

These checks protect the ALVIS design rule that local Qwen is the primary inference engine and network AI is optional enhancement only.

The checks verify:
- Online collaboration is off by default and requires an explicit per-message opt-in.
- The local Qwen engine remains required for normal chat.
- The one-shot online permission resets before making a request.
- Only the current question is sent to the online gateway.
- External AI output remains untrusted reference material.
- A failed online request falls through to local Qwen generation.
- Provider API keys are not embedded in the browser app.
- The app shell remains cached for offline navigation.
- Non-GET online requests are not cached.

These are static source-structure regression checks. They do not prove that model weights, WebGPU, TTS assets, or a full Safari reload work offline. Real-device airplane-mode tests remain required.
