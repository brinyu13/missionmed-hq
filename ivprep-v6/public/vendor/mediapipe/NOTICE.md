# MediaPipe local runtime notice

IV Prep On-Call uses a pinned, same-origin copy of `@mediapipe/tasks-vision` 1.0.1 for the Founder-only visual analytics test. The package is licensed under Apache-2.0 and has no transitive package dependencies.

Sources:

- Runtime: `https://www.npmjs.com/package/@mediapipe/tasks-vision/v/1.0.1`
- Holistic model: `https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task`
- BlazeFace short-range model: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite`
- License: `https://www.apache.org/licenses/LICENSE-2.0` and the adjacent local
  [`LICENSE`](./LICENSE) file

The installed `@mediapipe/tasks-vision` package metadata declares
`Apache-2.0`; its npm package does not include a standalone license file. The
adjacent `LICENSE` is the exact canonical Apache License 2.0 text.

Complete copied runtime/model inventory (documentation files excluded):

| Local path under `public/vendor/mediapipe/` | Bytes | SHA-256 |
| --- | ---: | --- |
| `tasks-vision/1.0.1/vision_bundle.mjs` | 155439 | `d885630c297c0b20b1fe86096cb06291c4c8080876f27852e724f24ac603713f` |
| `tasks-vision/1.0.1/wasm/vision_wasm_internal.js` | 323377 | `e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73` |
| `tasks-vision/1.0.1/wasm/vision_wasm_internal.wasm` | 11756954 | `8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886` |
| `tasks-vision/1.0.1/wasm/vision_wasm_module_internal.js` | 323415 | `da8934057f147b622e82cfb4c0dbd85461c598e268588b5a8ba9ca963a8ff82d` |
| `tasks-vision/1.0.1/wasm/vision_wasm_module_internal.wasm` | 11756972 | `2dabd8e23c60984628beb7bb338764c81a08e6837145273f59578684b5d53c1b` |
| `tasks-vision/1.0.1/wasm/vision_wasm_nosimd_internal.js` | 323180 | `e81d715a3d42cc3373602eb2f7aff795d164934db680e32496b65dab537f9658` |
| `tasks-vision/1.0.1/wasm/vision_wasm_nosimd_internal.wasm` | 10960242 | `a28483cd42e74e855bf5ebdb6b40d9b66a5b49e35e95020bc97669e6822a3192` |
| `models/holistic_landmarker/float16/1/holistic_landmarker.task` | 13683609 | `e2dab61191e2dcd0a15f943d8e3ed1dce13c82dfa597b9dd39f562975a50c3f8` |
| `models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite` | 229746 | `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f` |

The runtime and models load only from the local application origin. Raw camera frames remain inside the browser worker, raw landmarks never leave that worker, and only compact geometric observations are returned. The pinned MediaPipe bundle contains a Google utilization-metrics endpoint; the analytics worker rejects every non-same-origin Fetch/XHR request before importing MediaPipe, and the server Content Security Policy independently blocks non-same-origin connections. Browser privacy acceptance must show zero outbound analytics traffic.
