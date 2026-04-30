# ✔ Use a **single FFmpeg-generated MP4** as the canonical truth

# ✔ Extract each box from that MP4 into its own fixture

# ✔ Every box test compares its builder output to its fixture

This provides 

* correctness (fixtures come from FFmpeg, not from your own code)
* determinism (fixtures do not change unless you regenerate them)
* simplicity (box tests become trivial)
* speed (tests do not run FFmpeg or mp4box in the browser)
* purity (NativeMuxer stays architecture-clean)

---

# 🧠 Why a single MP4 is enough

Because an MP4 file contains:

```
ftyp
moov
  mvhd
  trak
    tkhd
    mdia
      mdhd
      hdlr
      minf
        vmhd
        dinf
          dref
        stbl
          stsd
            avc1
              avcC
          stts
          stsc
          stsz
          stco
mdat
```

That one MP4 contains **every leaf box the muxer needs** (except more exotic ones).

Simply extract each of them:

```
reference/mvhd.bin
reference/tkhd.bin
reference/mdhd.bin
reference/hdlr.bin
reference/vmhd.bin
reference/dref.bin
reference/stsd.bin
reference/avc1.bin
reference/avcC.bin
reference/stts.bin
reference/stsc.bin
reference/stsz.bin
reference/stco.bin
reference/ftyp.bin
```

---

# 🧪 Tests look like:

Example: test_mvhd.js

```js
import { serializeBoxTree } from "../serializer/serializeBoxTree.js"
import { buildMvhdBox } from "../boxes/mvhdBox.js"
import { loadFixture, assertBytesEqual } from "./testUtils.js"

export async function testMvhd() {
    const expected = loadFixture("reference/mvhd.bin")

    const node = buildMvhdBox({
        timescale: 90000,
        duration: 90000 * 2,
        nextTrackId: 2
    })

    const actual = serializeBoxTree(node)

    assertBytesEqual(actual, expected)
}
```

Clean. Deterministic. Correct.

No MP4Box.js.
No ambiguity.
No circular dependencies.

---

# ✔ Why this works

Because FFmpeg:

* is the de facto reference H.264→MP4 muxer
* is stricter than most browsers
* sets fields that H.264 decoders expect
* creates fully standards-compliant MP4s

If your boxes match FFmpeg, you are golden.

---

# 🔧 Here is the full plan in steps (simple and real)

## **Step 1 — Generate the reference MP4 with FFmpeg**

Run this once:

```
ffmpeg -f lavfi -i color=c=black:s=128x128:d=1 \
       -c:v libx264 -tune zerolatency -pix_fmt yuv420p \
       reference.mp4
```

This produces:

* 1-frame valid H.264 video
* perfect container metadata
* playable in Safari, Chrome, Firefox, everything
* ffprobe-valid, ffplay-valid

## **Step 2 — Generate the audio reference MP4 with FFmpeg**

```
ffmpeg \
  -f lavfi -i color=c=black:s=128x128:d=1:r=30 \
  -f lavfi -i sine=frequency=440:sample_rate=48000:d=1 \
  -c:v libx264 -tune zerolatency -pix_fmt yuv420p \
  -g 30 -keyint_min 30 -sc_threshold 0 \
  -c:a aac -profile:a aac_low -ar 48000 -ac 2 -b:a 128k \
  -shortest \
  reference_av.mp4
```

## **Generate the audio with Opus codec reference MP4 with FFmpeg**

```
ffmpeg -f lavfi -i sine=frequency=440:duration=5 \
  -c:a libopus \
  -ar 48000 \
  -ac 2 \
  -movflags +faststart \
  opus_oracle.mp4

```

## **Generate the video & audio with Opus codec reference MP4 with FFmpeg**
```
ffmpeg \
  -f lavfi -i color=c=black:s=128x128:r=30:d=5 \
  -f lavfi -i sine=frequency=440:sample_rate=48000:d=5 \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -profile:v baseline \
  -level 3.0 \
  -g 30 \
  -keyint_min 30 \
  -sc_threshold 0 \
  -c:a libopus \
  -ar 48000 \
  -ac 2 \
  -b:a 128k \
  -movflags +faststart \
  -shortest \
  reference_av_opus.mp4
```

Normalize the Opus packetization so STCO can be derived from WebCodecs-shaped access units
This modifies the layout fo the STSZ to produce a constant sample size.
```
# extract the audio track (opus) as PCM/WAV
ffmpeg -i reference_av_opus.mp4 -map 0:a:0 -c:a pcm_s16le reference_av_opus.wav

# re-encode opus with fixed-size packets (WebCodecs-friendly)
opusenc --framesize 20 --hard-cbr reference_av_opus.wav reference_av_opus.opus 

# now mux the rencoded opus audio into the reference mp4
ffmpeg -y -i reference_av_opus.mp4 -i reference_av_opus.opus -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy -movflags +faststart reference_av_opus_remuxed.mp4

# now replace the original oracle.
mv reference_av_opus_remuxed.mp4 reference_av_opus.mp4
```
---

## **Generate a local CO64 oracle (for `co64` extractor/emitter tests)**

`co64` appears when chunk offsets need 64-bit storage.
Practical rule: your MP4 must end up above ~4 GiB (32-bit `stco` limit).

Recommended low-impact command in this repo (fast CPU, still forces `co64`):

```bash
ffmpeg -hide_banner -y \
  -f lavfi -i testsrc2=size=640x360:rate=30:duration=60 \
  -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p \
  -b:v 600M -minrate 600M -maxrate 600M -bufsize 1200M \
  -x264-params nal-hrd=cbr:force-cfr=1 \
  -an \
  reference_co64.mp4
```

Notes:
- Produces a very large local file (~4.2 GiB in our run).
- Keep it local; do not commit it.
- Requires enough free disk and RAM to run co64 tests against it.
- `co64` tests are node-only by design; browser harness skips them.

If you want a smaller oracle, reduce `duration` but keep output above ~4 GiB.
If FFmpeg writes `stco` instead of `co64`, increase duration by `+5s`.

Verification:

```bash
ffprobe -v trace reference_co64.mp4 2>&1 | rg -n "co64|stco"
```

Expected:
- output contains `type:'co64' parent:'stbl'`
- no `stco` for that same track table

If `reference_co64.mp4` is missing, co64 tests fail with an error that points back to this README section.

---

## **Generate a local HEVC oracle (for `hvc1` demux/config tests)**

Generate a deterministic HEVC MP4 fixture (small, local, reproducible):

```bash
ffmpeg -hide_banner -y \
  -f lavfi -i testsrc2=size=128x128:rate=30:duration=2 \
  -c:v libx265 -preset ultrafast \
  -x265-params keyint=30:min-keyint=30:scenecut=0 \
  -pix_fmt yuv420p \
  -tag:v hvc1 \
  -an \
  reference_hevc.mp4
```

Verification:

```bash
ffprobe -v trace reference_hevc.mp4 2>&1 | rg -n "hvc1|hev1|hvcC"
```

Expected:
- sample entry is `hvc1` (or `hev1` on some encoders)
- `hvcC` is present in `stsd/sample[0]`

If `reference_hevc.mp4` is missing, `test_extractTrackCodecConfiguration_hvc1_referenceFixture` fails and points to this README section.

---

## **Generate a local WebM oracle (for EBML/WebM demux tests)**

Generate a deterministic VP9+Opus WebM fixture:

```bash
ffmpeg -hide_banner -y \
  -f lavfi -i testsrc2=size=128x128:rate=30:duration=2 \
  -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2 \
  -c:v libvpx-vp9 \
  -b:v 600k \
  -g 30 -keyint_min 30 \
  -row-mt 1 -tile-columns 1 \
  -deadline good -cpu-used 4 \
  -c:a libopus -b:a 96k -ar 48000 -ac 2 \
  -shortest \
  reference_webm_vp9_opus.webm
```

Extract raw mkvinfo oracle text (one-time generation step):

```bash
mkvinfo -a -v --ui-language en_US \
  reference_webm_vp9_opus.webm \
  > reference_webm_vp9_opus.mkvinfo.full.txt
```

Normalize mkvinfo output into stable comparison shape:

```bash
node normalize_webm_mkvinfo_oracle.mjs \
  reference_webm_vp9_opus.mkvinfo.full.txt \
  reference_webm_vp9_opus.oracle.json
```

Optional cross-check dump (not used by runtime tests):

```bash
ffprobe -v quiet -print_format json \
  -show_format -show_streams -show_packets \
  reference_webm_vp9_opus.webm \
  > reference_webm_vp9_opus.ffprobe.json
```

What this gives:

- `reference_webm_vp9_opus.webm` (fixture bytes)
- `reference_webm_vp9_opus.mkvinfo.full.txt` (full mkvinfo oracle dump)
- `reference_webm_vp9_opus.oracle.json` (stable, test-friendly summary used by tests)
- `reference_webm_vp9_opus.ffprobe.json` (optional cross-check dump)

Verification:

```bash
ffprobe -hide_banner reference_webm_vp9_opus.webm
```

Expected:

- video codec: `vp9`
- audio codec: `opus`
- video stream count: `1`
- audio stream count: `1`

If WebM oracle files are missing, these tests fail and point back to this README:

- `test_webm_oracle_referenceFixture_isPresentAndSane`
- `test_webm_openContainer_readerAgreement_withStoredOracle`

## **Generate local reproducible “phone-like” HEVC->WebM proof fixture (optional)**

This is a local regression proof workflow for source-normalization planning.
It is reproducible from `lavfi` (no personal phone capture required).

Step 1: generate a phone-like HEVC MP4 source:

```bash
ffmpeg -hide_banner -y \
  -f lavfi -i testsrc2=size=1080x1920:rate=30:duration=6 \
  -f lavfi -i sine=frequency=440:sample_rate=48000:duration=6 \
  -c:v libx265 -tag:v hvc1 -pix_fmt yuv420p -profile:v main \
  -x265-params keyint=30:min-keyint=30:scenecut=0 \
  -metadata:s:v:0 rotate=90 \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -shortest \
  reference_phone_like_hvc1.mp4
```

Step 2: normalize to WebM VP9+Opus:

```bash
ffmpeg -hide_banner -y \
  -i reference_phone_like_hvc1.mp4 \
  -c:v libvpx-vp9 -b:v 1400k \
  -deadline good -cpu-used 4 -row-mt 1 -tile-columns 1 \
  -c:a libopus -b:a 128k -ar 48000 -ac 2 \
  reference_webm_phone_like_vp9_opus.webm
```

Step 3: generate mkvinfo-backed oracle JSON:

```bash
mkvinfo -a -v --ui-language en_US \
  reference_webm_phone_like_vp9_opus.webm \
  > reference_webm_phone_like_vp9_opus.mkvinfo.full.txt

node normalize_webm_mkvinfo_oracle.mjs \
  reference_webm_phone_like_vp9_opus.mkvinfo.full.txt \
  reference_webm_phone_like_vp9_opus.oracle.json
```

Important:
- This flow is optional/local and not part of default suite inputs.
- Do not treat these generated phone-like files as required committed fixtures.

---

## **Step 2 — Extract each box into fixtures**

I will generate the extractor script next, but conceptually:

```
mp4dump --discrete reference.mp4
```

or:

```
mp4box -dump-box <BOXTYPE> reference.mp4
```

or using `mp4decrypt --show_boxes` or a custom parser.

You will get each box as raw bytes.

---

## **Step 3 — Put fixtures here:**

```
src/mux/native/tests/reference/ftyp.bin
src/mux/native/tests/reference/mvhd.bin
src/mux/native/tests/reference/tkhd.bin
...
src/mux/native/tests/reference/avc1.bin
src/mux/native/tests/reference/avcC.bin
...
```

---

## **Step 4 — Update each test to load the expected fixture**

Using:

```js
const expected = loadFixture("reference/mvhd.bin")
```

You compare to your builder.
