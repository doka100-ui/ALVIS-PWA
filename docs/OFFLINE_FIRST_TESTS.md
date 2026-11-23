# ALVIS offline-first regression tests

Run with Node.js 22 or later:

```sh
node tests/offline-first.test.mjs
```

These checks protect the ALVIS design rule that local Qwen is the primary inference engine and network AI is optional enhancement only.

## Coverage

- Online collaboration is off by default and requires explicit per-message opt-in.
- Local Qwen remains the primary engine; online failure falls through to local generation.
- External AI output is treated as untrusted reference material.
- Device profile selection keeps iPadOS desktop-class Safari on the iPad model/context profile.
- Inference serialization prevents overlapping requests and safely sequences model unload.
- Storage-persistence request outcomes (granted, denied, rejected, synchronous throw, unsupported) are handled without blocking model startup.
- Service Worker handlers execute in an isolated Node VM with mocked Cache API/network:
  - old ALVIS-owned app/dependency caches are retired;
  - WebLLM model/config/WASM caches are preserved;
  - existing model-cache hits are served before network;
  - trusted CDN dependencies are cached;
  - cached app-shell navigation works offline;
  - uncached offline dependencies return an explicit 503 response rather than HTML.
- App shell and non-GET cache policy remain protected by source-level checks.

The Service Worker behavior tests exercise the actual worker code, but use simulated Cache API/network objects. They do not prove Safari storage eviction policy, WebGPU model loading, TTS, or a complete iPad restart in airplane mode. Real-device acceptance remains required; see `docs/OFFLINE_ACCEPTANCE.md`. Never clear site data or model caches as part of these tests.
