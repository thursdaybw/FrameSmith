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

