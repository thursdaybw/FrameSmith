# Native MP4 muxer public API notes

This folder is the first vendored extraction of the native MP4 muxer from FrameSmith.

Source at extraction time:

```text
src/mux/native/
```

Vendored target:

```text
vendor/native-mp4-muxer/
```

This is still a vendored copy inside FrameSmith, not yet an npm package, CDN artifact, Git submodule, or standalone repo checkout.

## Current public API candidates

The following modules are used by FrameSmith or shared export glue today and are the first candidate public surface:

```text
openContainerFromMp4
openContainer
parseAudioSpecificConfigFromEsds
createMp4FromInputs
buildVideoTrackFromWebCodecs
buildAudioTrackFromWebCodecs
validateMp4BuildInput
```

The convenience barrel is:

```text
vendor/native-mp4-muxer/index.js
```

Deep imports still work because this vendored folder preserves the original native muxer directory shape.


## Heavy local fixtures

Some copied media fixtures are intentionally kept on local disk but ignored by git in this vendored split:

```text
tests/reference/reference_co64.mp4
tests/reference/phone_test.mp4
tests/2025-08-27-083128862 (copy 1).mp4
tests/framesmith.mp4
```

They are heavyweight/generated validation assets, not library source.

Regeneration/context docs live in:

```text
tests/reference/README.md
tests/fixtures/README.md
```

The Node harness skips optional oracle tests when their local-only dependencies or heavyweight fixtures are absent.

## Browser/WebCodecs smoke test

The native muxer owns a browser-only smoke runner:

```text
tests/browser/smoke.html
tests/browser/smoke.js
```

It runs WebCodecs audio/video encoding, feeds the result into the native MP4 muxer, validates MP4 structure, and can download the generated MP4 for manual inspection.

## Test strategy

The existing native muxer test harness can now run against either root:

```bash
node run_native_muxer_node_tests.mjs
NATIVE_MUXER_ROOT=./vendor/native-mp4-muxer node run_native_muxer_node_tests.mjs
```

The Node harness runs the browser test list where possible and skips browser/WebCodecs-only tests when the required browser APIs are not present.

The optional `mp4box.js` oracle comparison test is skipped when its local oracle dependency is not installed.

## Future extraction

Once the vendored boundary is stable, this folder can become the seed for a standalone repository such as:

```text
native-mp4-muxer
```

Do not add package/distribution mechanics before the public API and consumer boundaries settle.
