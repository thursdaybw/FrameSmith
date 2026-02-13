
# see behaviour prompt.

Please act as Robert C Martin aka Uncle Bob and bring your Clean Architecture wisdom to bear on this session. You need to act as my Senior Engineer, and I mean senior, bring all your 50 years of experience, embodying clean architecture, composable design, clean boundaries. .none of that normie stuff, we're building world class software here. Please apply clean code principles to generated code, 
Most importantly of call clear, plain text naming, name size can be relevant to scope, try and avoid jargon where possible.
When providing code give me procedural anchored instructions. Show preceding code lines of changes, mention file names and symbols when referencing any code , everytime.
no "Before the _____ function starts"  


###############################################################
#                                                             #
#                          OBSOLETE                           #
#                                                             #
# This document is obsolute, and kept for historical purposes #
# only.                                                       #
#                                                             #
###############################################################


# Historical only.. This is pre box emitters and none of this document reflects today's architecture.


# Top level MP4 file structure

```
MP4 file
├─ ftyp                      (File Type Box)
├─ moov                      (Movie Box) (container of children)
│  ├─ udta                   (tba ?)
│  │  └─ meta                (tba ?) 
│  │     ├─ hdlr             (Handler Reference Box)
│  │     └─ ilst             (tba ?)
│  ├─ mvhd                   (Movie Header Box)
│  └─ trak                   (Track Box) (container of children)
│     ├─ edts                
│     │  └─ elst             
│     ├─ tkhd                (Track Header Box)
│     └─ mdia                (Media Box)
│        ├─ mdhd             (Media Header Box)
│        ├─ hdlr             (Handler Reference Box)
│        └─ minf             (Media Information Box) (container of children)
│           ├─ smhd          (Audio Media Header Box)
│           ├─ vmhd          (Video Media Header Box)
│           ├─ dinf          (Data Information Box)
│           │  └─ dref       (Data Reference Box)
│           └─ stbl          (Sample Table Box) (container of children)
│              ├─ stsd       (Sample Descriptions Box)
│              │  └─ avc1    (AVC Sample Entry)
│              │     └─ avcC (AVC Configuration Box)
│              ├─ stts       (Decoding Time to Sample Box)
│              ├─ stsc       (Sample to Chunk Box)
│              ├─ stsz       (Sample Size Box)
│              └─ stco       (Chunk Offset Box)
└─ mdat                      (Media Data Box)
```

This is our existing plan: 

# Current state

Now that the scaffolding is complete, the next phase is implementation *in strict order*:

1. **AvcCExtractor** – Done  
2. **SampleCollector.addSample** – Done  
3. **TimingModel.addFrame & finalize** – Done  
4. **mdat construction** – Done  
5. **stsz, stsc, stts, stco tables** – Done  
6. **stsd → avc1 → avcC box** – Done  
7. **tkhd, mdhd, mvhd boxes** – Done  
8. **moov assembly** – Done  
9. **final finalize() implementation**, consisting of:
    - 9.1 **Build ftyp box** - Done
    - 9.2 **Compute final stco offsets** (after moov size is known)  
    - 9.3 **Assemble [ftyp], moov, mdat into final Uint8Array**  
    - 9.4 **Return final Blob**

All of this will be built in *small, safe, incremental diffs*.

---

# 📘 NativeMuxer Architecture Blueprint

### Minimal, Deterministic, Dependency-Free MP4 Muxer

### For Framesmith MVP + Future Timeline Editor

---

# 0. High-Level Overview

The muxer is a **pure, deterministic, synchronous builder** that accepts encoded H.264 Annex-B frames and produces a **complete MP4 file** composed of:

```
ftyp
moov
mdat
```

There are **four internal subsystems**, each cleanly separated:

1. **SampleCollector**
2. **AvcCExtractor**
3. **TimingModel**
4. **Assembler**

Each subsystem is independent.
Each has a single responsibility.
None of them know anything about WebCodecs or Framesmith.

The `NativeMuxer` class orchestrates them.

> **Box generation is no longer a subsystem.**
> Each box is implemented directly in its own module under `src/mux/native/boxes/`.

---

# 1. Class Structure

```ts
class NativeMuxer {
    constructor({ codec, width, height, fps }) {}

    addVideoFrame(encodedFrame) {}      // store sample metadata + bytes

    async finalize() : Promise<Blob> {} // build MP4 container, return Blob
}
```

That’s the entire public interface.

Everything below is internal, private, and replaceable.

---

---

# 2. Subsystem 1: SampleCollector

Purpose:
Collect raw bytes and metadata for each sample.

Internal representation of a sample:

```ts
{
    size: number,           // byteLength
    isKey: boolean,         // encodedFrame.type === "key"
    timestamp: number,      // microseconds in encode domain
    duration: number,       // microseconds per frame
    data: Uint8Array        // the NALU bytes
}
```

Fields SampleCollector maintains:

```ts
samples: Sample[] = [];
totalMdatSize: number = 0;
```

Responsibilities:

* copy Annex-B payload from chunk into Uint8Array
* push sample metadata into samples array
* maintain total mdat size
* detect first keyframe for SPS/PPS extraction

**SampleCollector must never process MP4 logic**.
It is a dumb list builder.

---

# 3. Subsystem 2: AvcCExtractor

Purpose:
Extract SPS and PPS from Annex-B bitstreams.

Responsibilities:

* Detect start codes (00 00 00 01 or 00 00 01)

* Parse NALU type

* Collect:

  * SPS (type 7)
  * PPS (type 8)

* Build a valid AVCDecoderConfigurationRecord (`avcC`)

* Provide profile/level info from SPS

API:

```ts
class AvcCExtractor {
    ingestSample(sampleBytes) : void
    hasConfig() : boolean
    getAvcC() : Uint8Array
}
```

The first keyframe sample is sufficient.

**AvcCExtractor outputs only the avcC payload**, not the box.

---

# 4. Subsystem 3: TimingModel

Purpose:
Convert ExportEngine timestamps into MP4 decoding time units.

You store timestamps in microseconds.
Muxer requires 90k timescale.

Convert:

```
mp4_timestamp = (us_timestamp / 1_000_000) * 90000
mp4_duration  = 90000 / fps
```

TimingModel also produces:

* totalDuration
* stts (time-to-sample) entries

For V1 (fixed-frame-rate), stts is a single entry:

```
{ sample_count: N, sample_duration: floor(90000 / fps) }
```

API:

```ts
class TimingModel {
    constructor(fps)
    addFrame(timestampUs)
    finalize() : { sttsEntries, totalDuration }
}
```

---

# 5. Subsystem 4: **REMOVED (BoxBuilder)**

### ❌ Original purpose (now removed):

> To produce binary MP4 boxes as a unified abstraction.

### ✔ Why it was removed:

* It provided **no abstraction benefit**.
* It simply forwarded arguments to leaf box functions.
* It introduced unnecessary ceremony and cognitive load.
* It created an architectural layer that did not protect against volatility or duplication.
* Each box already lives naturally in its own module (`boxes/*.js`).
* Clean Architecture teaches:

  > *Do not introduce indirection unless it eliminates duplication or isolates volatility.*

### ✔ What replaced it:

Each MP4 box has **its own builder** in `src/mux/native/boxes/`, e.g.:

```
mvhdBox.js
tkhdBox.js
mdhdBox.js
hdlrBox.js
vmhdBox.js
dinfBox.js
drefBox.js
stsdBox.js
sttsBox.js
stscBox.js
stszBox.js
stcoBox.js
```

The **moov assembly logic** lives in:

```
src/mux/native/boxes/moovBox.js
```

This module:

* Composes mvhd
* Builds trak
* Builds mdia/minf/stbl hierarchies
* Produces the final `moov` Uint8Array

No global façade is required.

---

# 6. Subsystem 5: Assembler

Purpose:
Concatenate:

```
ftyp
moov
mdat
```

Assembler is pure and dumb:

```ts
concat(buffers: Uint8Array[]) : Uint8Array
```

No MP4 logic, just joining.

---

# 7. NativeMuxer Internal State Machine

```txt
constructor → READY

addVideoFrame() → COLLECTING

finalize() → BUILDING → COMPLETE
```

`finalize()` can only be called once.

If finalize() is called with no SPS/PPS extracted, you throw a helpful error:

> NativeMuxer: No SPS/PPS found. Did you encode H.264 Annex-B?

This prevents nonsense MP4s.

---

# 8. Internal Flow of finalize()

*“moov is constructed by calling `buildMoovBox()` in the boxes directory.”*

### Step 1: Freeze samples

Take current samples array.
No more frames allowed after this.

### Step 2: build sample tables

* stts via TimingModel
* stsc (1:1 mapping, constant)
* stsz (array of sizes)
* stco (computed later based on offsets)

### Step 3: build avcC

Using AvcCExtractor.

### Step 4: build stsd

Wrap avc1 + avcC.

### Step 5: compute box sizes

For accurate stco offsets.

### Step 6: build mdat header

Size = 8 + total sample bytes.

### Step 7: assemble everything as:

```
ftyp
moov
mdatHeader
all sample bytes, concatenated
```

### Step 8: wrap into Blob


---

# 9. Memory Strategy

Zero-copy where possible:

* sample bytes stored once upon addVideoFrame
* final assembly uses a single allocation sized to total output
* mdat constructed via single concatenation

This avoids quadratic behavior.

---

# 10. Error Boundaries

### Throw if:

* addVideoFrame called after finalize
* encodedFrame does not provide valid byteLength
* no SPS/PPS present by finalize
* width/height/codec missing
* fps <= 0

Clean architecture means **errors leave the system in a recoverable state**.
The muxer is stateless after finalize returns.

---

# 11. Adapter Layer Between ExportEngine and NativeMuxer

ExportEngine should adapt to muxer, not the reverse.

Minimal changes:

```js
const muxer = new NativeMuxer({
    codec: trackInfo.codec, // or your chosen canonical codec string, e.g. "avc1.640028"
    width: 720,
    height: 1280,
    fps: this.fps,
});
```

Muxer remains independent of ExportEngine and WebCodecs.

---

# 12. Test Harness Architecture

```
tests/native-muxer/
    index.html
    test.js
    colorFrames.js     <- generates synthetic frames
```

Test does:

1. Generate red/green/blue frames
2. Encode via WebCodecs
3. Feed into new NativeMuxer
4. download mp4
5. manually verify playback in Safari, Chrome, VLC

This harness becomes a permanent regression test.

---

# 13. Why This Architecture Works for Future Features

### Audio

Just add a parallel SampleCollector + stbl tree.

### Fragmentation (moof/mdat)

Replace Assembler with a streaming assembler.
SampleCollector unchanged.
TimingModel unchanged.

### Timeline editor

Time warping and frame re-timing happen in ExportEngine, not in muxer.

### Editing operations

stts, ctts, stco adjust, but architecture remains clean.

### B-frames

Requires CTS offsets, but TimingModel handles that in V2.

There is no future where this architecture breaks.
This is the bedrock.

---

# ✔ CONCLUSION

You now have a **complete, clean, minimal, extensible architecture** for the NativeMuxer.

This is the correct design.
It solves the MVP.
It scales into a full NLE muxer.
It respects Clean Architecture.
It separates concerns perfectly.
It is understandable, testable, and maintainable.

---

# ✔ NEXT STEP

The next step is to generate the directory and file structure:

```
src/mux/native/
    NativeMuxer.js
    SampleCollector.js
    AvcCExtractor.js
    TimingModel.js
    Assembler.js
    utils.js
    mdatBuilder.js
src/mux/native/boxes/
    stszBox.js
    stscBox.js
    sttsBox.js
    stcoBox.js
    tkhdBox.js
    mdhdBox.js
    mvhdBox.js
    hdlrBox.js
    vmhdBox.js
    drefBox.js
    dinfBox.js
    stsdBox.js
    stsdBox/
        avc1Box.js
        avc1Box/
            avcCBox.js
```

Then we begin implementing each subsystem in small, incremental diffs.

