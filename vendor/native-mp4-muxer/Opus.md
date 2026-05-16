## The hard truth (but the useful kind)

> Opus-in-MP4 is not “mp4a with ESDS”.

That model works for AAC.
It does **not** work for Opus.

Players *will* mis-detect it as AAC and invent nonsense like:

* `0 channels`
* `1000000 Hz`
* broken audio clock
* video stalls and seek jumps

Which is *exactly* what you’re seeing.

So we’re not debugging random bugs anymore.
We’re implementing **one specific container rule-set**.

---

## What Opus-in-MP4 actually requires (minimal, correct)

### 1. Sample Entry

* Still `mp4a` (yes, confusing, but correct)
* BUT with **Opus-specific signalling**

### 2. Sample rate rule (critical)

> **Opus in MP4 is always signalled as 48000 Hz**

Even if the original audio was 44.1kHz.

This is non-negotiable.

If you put anything else in the mp4a sample rate field, players lose the audio clock.

---

### 3. Channel count

Must be explicitly set from Opus metadata:

* 1 = mono
* 2 = stereo
* etc

**0 is invalid** and triggers exactly your FFmpeg warning.

---

### 4. Decoder configuration (this is the missing piece)

For Opus, you must include **OpusSpecificBox (`dOps`)**, *not* ESDS.

This box contains:

* channel count
* pre-skip
* input sample rate (still 48000)
* output gain
* channel mapping family

Without `dOps`, players guess — badly.

---

## Why your current output fails

Right now your file is doing roughly this:

* WebCodecs → Opus frames ✅
* mp4a sample entry ❌ (AAC-style)
* ESDS ❌ (wrong codec model)
* sampleRate derived from timescale ❌
* channelCount missing ❌

FFmpeg then says:

> “Well… I guess this is AAC???”
> …and everything goes downhill from there.

---

## The correct mental model (important)

You already did the hard part:

* timing
* chunking
* STSC / STCO
* interleaving
* mux pipeline

**Opus-in-MP4 is a *container exception***.

It belongs in:

* a **container policy**
* a **codec-specific adapter**
* not in generic audio logic

That’s actually *good news* architecturally.

---

## The minimal implementation plan (no fluff)

### Step 1 — Treat Opus as its own container case

You already branch on codec family. Extend it cleanly:

```js
if (rawStsdParams.codec === "opus") {
    // Opus-in-MP4 path
}
```

Not “mp4a with tweaks”. A real branch.

---

### Step 2 — Emit mp4a + dOps

You will:

* emit an `mp4a` sample entry
* **omit ESDS**
* include a `dOps` child box

Required mp4a fields:

* `channelCount` → from Opus
* `sampleRate` → **48000**
* `sampleSize` → 16 (container default)

---

### Step 3 — Build `dOps` correctly

From WebCodecs you already have enough:

* channelCount
* preSkip (usually present)
* sampleRate (always write 48000)
* outputGain = 0
* channelMappingFamily (usually 0 or 1)

Once `dOps` is present, FFmpeg will immediately stop guessing.

---

## How you’ll know it’s fixed (before VLC)

Run:

```bash
ffprobe -show_streams webcodecs-native-muxer.mp4
```

You want to see:

* `codec_name=opus`
* `sample_rate=48000`
* `channels=2` (or whatever)
* no warnings about codec parameters

When that happens:

* black frames disappear
* seek bar becomes smooth
* video starts instantly

---

## One very important reassurance

You did **not** waste a month.

You:

* built a real MP4 compiler
* crossed the audio+video mux boundary
* exposed the *exact* industry edge-case everyone hits
* arrived at a known, solvable spec detail

Most people never get this far.

If you want, next we can:

* sketch the `dOps` box structure exactly as bytes, or
* map WebCodecs Opus config → `dOps` fields line by line

No hand-waving this time.
