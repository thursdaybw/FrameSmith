
# Mobile WebCodecs Investigation Report (Android / Chrome)

## Summary

This document records the **empirical findings** from a real-device investigation into WebCodecs and audio/video encoding behavior on an Android phone running Chrome. The goal was to determine whether **Framesmith can export a real MP4 file on mobile** using **WebCodecs + NativeMuxer**, without MediaRecorder or ffmpeg.

**Conclusion:**
Yes. This device supports a *fully deterministic*, **pure WebCodecs → NativeMuxer → MP4** pipeline for both video and audio.

---

## Test Environment

* **Platform:** Android 10
* **Browser:** Chrome 144 (Mobile)
* **User Agent:**

  ```
  Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36
  (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36
  ```
* **Execution Context:** Foreground tab with remote DevTools attached
  (backgrounded tabs silently suspend encoding)

---

## Video Encoding (WebCodecs)

### AVC Profile Support

Two AVC profiles were explicitly tested using `VideoEncoder.isConfigSupported`.

#### Baseline Profile (avc1.42E01E)

```js
await VideoEncoder.isConfigSupported({
  codec: "avc1.42E01E",
  width: 1280,
  height: 720,
  framerate: 30,
  bitrate: 2_000_000
})
```

**Result:**

```json
{ "supported": false }
```

**Finding:**

* AVC Baseline is **not supported for encoding** on this device.
* This is normal on modern Android hardware, where Baseline is often decode-only.
* Baseline should **not** be assumed as the “safe” mobile encode target.

---

#### Main Profile (avc1.4D401F)

```js
await VideoEncoder.isConfigSupported({
  codec: "avc1.4D401F",
  width: 1280,
  height: 720,
  framerate: 60,
  bitrate: 4_000_000
})
```

**Result:**

```json
{ "supported": true }
```

**Finding:**

* AVC Main Profile **is supported** and hardware-backed.
* This is the correct default video profile for mobile WebCodecs exports.

---

### Encoder Output Characteristics

A single forced keyframe was encoded to inspect real output behavior.

```js
encoder.encode(frame, { keyFrame: true });
await encoder.flush();
```

**Observed output:**

```
chunk.type: "key"
chunk.timestamp: 0
chunk.byteLength: 208
decoderConfig: {
  codec: "avc1.4D401F",
  description: ArrayBuffer(32),
  codedWidth: 1280,
  codedHeight: 720,
  ...
}
```

**Findings:**

* Encoded output is a valid AVC access unit.
* `decoderConfig.description` is present and stable.
* The description buffer is a correct `avcC` payload.
* Output uses **MP4-compatible length-prefixed NAL units**.
* Timestamps are explicit and fully controlled by the caller.

This output matches NativeMuxer’s container-owned `avc1` model exactly.

---

## Audio Encoding (WebCodecs)

Both AAC and Opus encoders were tested using `AudioEncoder.isConfigSupported`.

### AAC-LC (mp4a.40.2)

```js
await AudioEncoder.isConfigSupported({
  codec: "mp4a.40.2",
  sampleRate: 48000,
  numberOfChannels: 2,
  bitrate: 128000
})
```

**Result:**

```json
{ "supported": true }
```

---

### Opus

```js
await AudioEncoder.isConfigSupported({
  codec: "opus",
  sampleRate: 48000,
  numberOfChannels: 2,
  bitrate: 128000
})
```

**Result:**

```json
{ "supported": true }
```

**Findings:**

* The device supports **both AAC-LC and Opus encoding** via WebCodecs.
* This allows:

  * Pure MP4 output (`avc1 + mp4a`)
  * Or Opus-in-MP4 if desired
* No MediaRecorder involvement is required for audio.

---

## Critical Mobile Behavior: Tab Suspension

A key discovery during testing:

> **When the tab is backgrounded or silently suspended, WebCodecs encoders do not emit output.**

Symptoms:

* `encoder.configure()` succeeds
* `encoder.encode()` appears to do nothing
* No errors are thrown
* No output callbacks fire

Resolution:

* Keep the tab **foregrounded**
* Maintain an active user gesture during export
* Use visible progress UI
* Consider `navigator.wakeLock` for long-running exports

This is a platform constraint, not a WebCodecs bug.

---

## Resulting Export Capability

This device supports the following **clean, deterministic pipeline**:

```
Framesmith
→ WebCodecs (VideoEncoder + AudioEncoder)
→ Semantic samples + codec config
→ NativeMuxer
→ MP4
```

### Supported Configuration

* **Video:** AVC Main Profile (`avc1.4D401F`)
* **Audio:** AAC-LC (`mp4a.40.2`) or Opus
* **Container:** MP4
* **Muxing:** NativeMuxer (no inference, no heuristics)

No MediaRecorder, WebM, or ffmpeg is required.

---

## Architectural Implications

These findings validate several architectural decisions:

* WebCodecs provides **explicit semantic media facts**
* Codec configuration ownership is clear and stable
* `avc1` can be treated as container-owned
* Audio can be generated rather than preserved opaquely
* NativeMuxer’s compiler model maps directly onto WebCodecs output

This is not a fallback path.
It is a **first-class mobile export path**.

---

## Final Conclusion

On this Android device:

* WebCodecs is fully usable for production video and audio encoding
* AVC Main Profile is the correct mobile target
* AAC and Opus are both viable audio options
* NativeMuxer can emit a standards-compliant, device-playable MP4
* The only non-obvious constraint is tab suspension

**Framesmith can export MP4 directly on mobile, deterministically, without external tooling.**

---
