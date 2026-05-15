# FrameSmith

FrameSmith is a self-contained browser video composition and export tool.

This project intentionally avoids making a package manager or bundler part of the runtime contract. Plain browser-served files are preferred unless a stronger reason appears.

## Vendored browser transcription runtime

The local transcription vendoring spike lives beside the original CDN/control spike:

```text
transcription_spike.html
transcription_spike.js
transcription_vendor_spike.html
transcription_vendor_spike.js
```

The CDN/control spike should remain available while vendoring is being proven. It gives us a known-good comparison point when local assets fail to load.

### Current vendored runtime

Transformers.js is vendored as static browser files under:

```text
vendor/transformers/4.0.1/
```

Current Transformers.js files:

```text
vendor/transformers/4.0.1/LICENSE
vendor/transformers/4.0.1/package.json
vendor/transformers/4.0.1/transformers.web.js
vendor/transformers/4.0.1/transformers.web.min.js
vendor/transformers/4.0.1/ort-wasm-simd-threaded.jsep.mjs
```

The vendor spike imports the local browser bundle directly:

```js
import { pipeline } from "./vendor/transformers/4.0.1/transformers.web.min.js";
```

Transformers.js also expects ONNX Runtime package specifiers to be resolvable in the browser. Because FrameSmith does not use a bundler, the vendor spike supplies those mappings with an HTML import map.

Current ONNX Runtime files:

```text
vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/package.json
vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/README.md
vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/dist/ort.webgpu.bundle.min.mjs
vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/dist/ort.wasm.bundle.min.mjs
vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/dist/ort-wasm-simd-threaded.jsep.mjs
vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/dist/ort-wasm-simd-threaded.jsep.wasm
vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/dist/ort-wasm-simd-threaded.mjs
vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/dist/ort-wasm-simd-threaded.wasm
vendor/onnxruntime-common/1.24.0-dev.20251116-b39e144322/
```

Current import map:

```html
<script type="importmap">
{
    "imports": {
        "onnxruntime-web/webgpu": "./vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/dist/ort.webgpu.bundle.min.mjs",
        "onnxruntime-web/wasm": "./vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/dist/ort.wasm.bundle.min.mjs",
        "onnxruntime-web": "./vendor/onnxruntime-web/1.25.0-dev.20260327-722743c0e2/dist/ort.webgpu.bundle.min.mjs",
        "onnxruntime-common": "./vendor/onnxruntime-common/1.24.0-dev.20251116-b39e144322/dist/esm/index.js"
    }
}
</script>
```

There is no FrameSmith `package.json`, no `node_modules`, and no build step. `npm` is used only as a pinned artifact download/extraction tool.

### How the runtime was vendored

From the FrameSmith directory:

```bash
cd /home/bevan/workspace/bevansbench.com/html/framesmith

mkdir -p vendor/transformers/4.0.1
workdir=$(mktemp -d)

cd "$workdir"
npm pack @huggingface/transformers@4.0.1 >/dev/null
tar -xzf huggingface-transformers-4.0.1.tgz

cd /home/bevan/workspace/bevansbench.com/html/framesmith
cp "$workdir/package/LICENSE" vendor/transformers/4.0.1/LICENSE
cp "$workdir/package/package.json" vendor/transformers/4.0.1/package.json
cp "$workdir/package/dist/transformers.web.js" vendor/transformers/4.0.1/transformers.web.js
cp "$workdir/package/dist/transformers.web.min.js" vendor/transformers/4.0.1/transformers.web.min.js
cp "$workdir/package/dist/ort-wasm-simd-threaded.jsep.mjs" vendor/transformers/4.0.1/ort-wasm-simd-threaded.jsep.mjs

rm -rf "$workdir"
```

### How to update Transformers.js later

Use a new versioned directory rather than replacing the old one in place:

```text
vendor/transformers/4.0.1/
vendor/transformers/<new-version>/
```

Then update only the import in the spike or production adapter being tested:

```js
import { pipeline } from "./vendor/transformers/<new-version>/transformers.web.min.js";
```

Keep the old version until the new version has passed desktop and mobile tests. This keeps rollback simple and makes behavior changes visible in git.

Suggested update flow:

```bash
cd /home/bevan/workspace/bevansbench.com/html/framesmith

NEW_VERSION=4.0.1
mkdir -p "vendor/transformers/$NEW_VERSION"
workdir=$(mktemp -d)

cd "$workdir"
npm pack "@huggingface/transformers@$NEW_VERSION" >/dev/null
tar -xzf huggingface-transformers-$NEW_VERSION.tgz

cd /home/bevan/workspace/bevansbench.com/html/framesmith
cp "$workdir/package/LICENSE" "vendor/transformers/$NEW_VERSION/LICENSE"
cp "$workdir/package/package.json" "vendor/transformers/$NEW_VERSION/package.json"
cp "$workdir/package/dist/transformers.web.js" "vendor/transformers/$NEW_VERSION/transformers.web.js"
cp "$workdir/package/dist/transformers.web.min.js" "vendor/transformers/$NEW_VERSION/transformers.web.min.js"
cp "$workdir/package/dist/ort-wasm-simd-threaded.jsep.mjs" "vendor/transformers/$NEW_VERSION/ort-wasm-simd-threaded.jsep.mjs"

rm -rf "$workdir"
```

### Vendoring boundary

The first vendoring spike should use only the ONNX Community timestamped models that passed mobile WebGPU word-timestamp testing:

```text
onnx-community/whisper-tiny.en_timestamped
onnx-community/whisper-base_timestamped
```

Do not carry the Xenova models into the first vendoring spike. They remain useful in the CDN/control spike as fallback diagnostics, but the ONNX Community timestamped path is the candidate product path.

### Current state of the vendoring spike

Done:

```text
- Created transcription_vendor_spike.html
- Created transcription_vendor_spike.js
- Vendored Transformers.js browser runtime files
- Changed transcription_vendor_spike.js to import Transformers.js locally
```

Not done yet:

```text
- Vendor model files locally or serve them from FrameSmith-controlled artifact storage
- Change model dropdown values from Hugging Face repo ids to local/model-mirror paths
- Prove desktop WASM fallback from local runtime plus local/model-mirror model assets
- Prove mobile WebGPU from local runtime plus local/model-mirror model assets
```

Deferred intentionally:

```text
- Production model mirroring is tracked in GitHub issue #10.
- Do not bury model artifact provisioning in bevansbench.com Ansible unless it becomes urgent before FrameSmith is split into its own repo/domain/deployment.
```

### Production browser transcription adapter status

The production implementation branch now has a local browser Whisper adapter boundary:

```text
src/transcription/local/BrowserWhisperBackendProbe.js
src/transcription/local/TransformersBrowserWhisperRuntime.js
src/transcription/local/BrowserWhisperTranscriptionClient.js
```

Responsibilities are split deliberately:

```text
BrowserWhisperBackendProbe
  WebGPU adapter probing and device candidate order.

TransformersBrowserWhisperRuntime
  Transformers.js pipeline loading, backend options, and transcriber cache.

BrowserWhisperTranscriptionClient
  Shared TranscriptionClient port adapter that returns normalized transcription results.
```

The real UI is not wired to local transcription yet. UI selection and fallback policy belong to the later selection/use-case item, not the infrastructure adapter.

### Current vendor spike result

The vendor spike currently proves local runtime assets plus remote Hugging Face model files.

Phone testing over the mobile browser confirmed:

```text
onnx-community/whisper-tiny.en_timestamped
  device: webgpu
  timestampMode: word
  elapsedSeconds: 46.2s

onnx-community/whisper-base_timestamped
  device: webgpu
  timestampMode: word
  elapsedSeconds: 64.2s
```

These results are effectively the same as the previous CDN-runtime test, so vendoring the Transformers.js and ONNX Runtime browser assets did not materially hurt inference performance.

Current boundary:

```text
Local:
  Transformers.js browser runtime
  ONNX Runtime Web/Common browser runtime

Still remote:
  ONNX Community timestamped Whisper model files loaded from Hugging Face
```

### Test matrix to preserve

Before moving from spike to production adapter, prove:

```text
Desktop browser:
  Auto falls back to WASM when WebGPU adapter is unavailable.
  Word timestamps work for tiny timestamped model.

Mobile browser:
  Auto resolves to WebGPU when available.
  Word timestamps work for tiny timestamped model.
  Base timestamped model works as the quality option.
```
