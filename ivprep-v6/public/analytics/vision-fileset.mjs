// Vision WASM fileset resolution for MODULE workers.
//
// Both analytics vision workers are spawned with { type: 'module' } because they
// use ES imports. The vendored MediaPipe tasks-vision 1.0.1 bundle cannot load its
// own WASM glue from a module worker, in either flavour:
//
//   FilesetResolver.forVisionTasks(root)        -> vision_wasm_internal.js
//     MediaPipe's internal loader calls importScripts() first. In a module worker
//     importScripts() throws TypeError, so it falls back to await import(url).
//     That evaluates the non-MODULARIZE Emscripten glue as an ES module, where its
//     top-level `var ModuleFactory` stays module-scoped and never reaches
//     globalThis. MediaPipe then fails with "ModuleFactory not set."
//
//   FilesetResolver.forVisionTasks(root, true)  -> vision_wasm_module_internal.js
//     The second argument is NOT "force SIMD" - it selects the MODULARIZE build.
//     That build has top-level `import.meta`, which is a hard SyntaxError when the
//     loader parses it as a classic script: "Cannot use 'import.meta' outside a
//     module". The worker dies before the landmarker is constructed.
//
// Either way the entire vision stage failed closed on the hosted product: no face
// mesh, no head axes, no torso, no arm, hand or finger wireframes, and no
// landmark-derived signal. The repository shipped the second form.
//
// Fix: import the MODULARIZE glue ourselves, as a real ES module (which is exactly
// what it is built for), publish its factory where MediaPipe looks for it, then hand
// MediaPipe a loader path that is safe for its own loader to re-load. This module's
// own URL is used for that: it is already in the module map, so MediaPipe's
// importScripts -> import() fallback resolves it from cache and does nothing.
//
// MediaPipe clears self.ModuleFactory after consuming it, so the guard below
// re-publishes the factory on each construction.

const SIMD_PROBE_UNSUPPORTED = 'MediaPipe vision requires WebAssembly SIMD, which this browser did not report.';
const FACTORY_MISSING = 'The MediaPipe MODULARIZE glue did not export a module factory.';

export async function resolveVisionFileset(visionModule, wasmRoot) {
  const root = String(wasmRoot || '').trim().replace(/\/+$/u, '');
  if (!root) throw new TypeError('A MediaPipe wasm root is required.');

  // Only the SIMD MODULARIZE glue is vendored; there is no
  // vision_wasm_module_nosimd_internal build to fall back to. Fail honestly rather
  // than requesting a file that is not there.
  const simdSupported = await visionModule.FilesetResolver.isSimdSupported();
  if (!simdSupported) throw new Error(SIMD_PROBE_UNSUPPORTED);

  if (typeof self.ModuleFactory !== 'function') {
    const glue = await import(`${root}/vision_wasm_module_internal.js`);
    const factory = typeof glue?.default === 'function' ? glue.default : glue?.ModuleFactory;
    if (typeof factory !== 'function') throw new Error(FACTORY_MISSING);
    self.ModuleFactory = factory;
  }

  return {
    wasmLoaderPath: import.meta.url,
    wasmBinaryPath: `${root}/vision_wasm_module_internal.wasm`,
  };
}
