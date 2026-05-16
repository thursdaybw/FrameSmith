# NativeMuxer Demo

Paste these into the browser console one after another.

This sequence is optimized for a live walkthrough:

- simple console-friendly `var` bindings
- no `globalThis`
- no `__TEST_ONLY__`
- low-level extractor first
- higher-level container facade second

## 1. Load an MP4 fixture

```js
var response = await fetch("src/mux/native/tests/reference/reference_av.mp4");
var mp4Bytes = new Uint8Array(await response.arrayBuffer());
mp4Bytes.length
```

## 2. Import the low-level extractor API

```js
var goldenTruthModule = await import("/framesmith/src/mux/native/tests/goldenTruthExtractors/index.js");
var getGoldenTruthBox = goldenTruthModule.getGoldenTruthBox;
Object.keys(goldenTruthModule)
```

## 3. Resolve the top-level `moov` box

```js
var moov = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, "moov");
var moovReport = moov.readBoxReport();
moovReport
```

## 4. Resolve a richer leaf box: `tkhd`

```js
var tkhd = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
  mp4Bytes,
  "moov/trak[0]/tkhd"
);

tkhd.readBoxReport()
```

## 5. Resolve a richer structural box: `stbl`

```js
var stbl = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
  mp4Bytes,
  "moov/trak[0]/mdia/minf/stbl"
);

stbl.readBoxReport()
```

## 6. Import the higher-level container facade

```js
var openContainerModule = await import("/framesmith/src/mux/native/demux/container/openContainerFromMp4.js");
```

## 7. Open the MP4 as a container

```js
var container = openContainerModule.openContainerFromMp4({ mp4Bytes });
container
```

## 8. Create track views

```js
var trackViews = container.createTrackViews();
trackViews
```

## 9. Break out video and audio track views

```js
var videoTrack = container.createTrackViews({ mediaType: "video" })[0];
var audioTrack = container.createTrackViews({ mediaType: "audio" })[0];

({ videoTrack, audioTrack })
```

## 10. Show the useful high-level shape

```js
({
  videoMediaType: videoTrack.mediaType,
  videoSampleCount: videoTrack.sampleCount,
  videoCodec: videoTrack.codecConfig,
  videoMeta: videoTrack.containerMeta,
  audioMediaType: audioTrack.mediaType,
  audioSampleCount: audioTrack.sampleCount,
  audioCodec: audioTrack.codecConfig,
  audioMeta: audioTrack.containerMeta
})
```

## 11. Show real sample objects

```js
({
  firstVideoSample: videoTrack.getSampleByIndex(0),
  secondVideoSample: videoTrack.getSampleByIndex(1),
  firstAudioSample: audioTrack.getSampleByIndex(0)
})
```

## 12. Show a few more sample timings

```js
[
  videoTrack.getSampleByIndex(0),
  videoTrack.getSampleByIndex(1),
  videoTrack.getSampleByIndex(2)
].map(sample => ({
  pts: sample.pts,
  dts: sample.dts,
  duration: sample.duration,
  isKey: sample.isKey,
  size: sample.data.length
}))
```

## 13. Optional direct demux helpers

These are still useful, but they are no longer the main story.

```js
var codecModule = await import("/framesmith/src/mux/native/demux/container/extractTrackCodecConfigurationFromMp4.js");
var metaModule = await import("/framesmith/src/mux/native/demux/container/extractTrackContainerMetadataFromMp4.js");
var unitsModule = await import("/framesmith/src/mux/native/demux/container/extractSemanticAccessUnitsFromMp4.js");
```

## 14. Optional direct codec config helpers

```js
var videoCodec = codecModule.extractTrackCodecConfigurationFromMp4({
  mp4Bytes,
  zeroBasedTrackIndex: 0
});

var audioCodec = codecModule.extractTrackCodecConfigurationFromMp4({
  mp4Bytes,
  zeroBasedTrackIndex: 1
});

({ videoCodec, audioCodec })
```

## 15. Optional direct metadata helpers

```js
var videoMeta = metaModule.extractTrackContainerMetadataFromMp4({
  mp4Bytes,
  zeroBasedTrackIndex: 0,
  includeDisplayTransform: true
});

var audioMeta = metaModule.extractTrackContainerMetadataFromMp4({
  mp4Bytes,
  zeroBasedTrackIndex: 1,
  includeDisplayTransform: true
});

({ videoMeta, audioMeta })
```

## 16. Optional direct access unit helpers

```js
var videoUnits = unitsModule.extractSemanticAccessUnitsFromMp4({
  mp4Bytes,
  zeroBasedTrackIndex: 0
});

var audioUnits = unitsModule.extractSemanticAccessUnitsFromMp4({
  mp4Bytes,
  zeroBasedTrackIndex: 1
});

({
  videoCount: videoUnits.length,
  audioCount: audioUnits.length,
  firstVideoUnit: videoUnits[0],
  firstAudioUnit: audioUnits[0]
})
```

## 17. Optional keyframe view

```js
videoUnits.filter(unit => unit.isKey).slice(0, 5)
```

## 18. Compact final summary

```js
({
  videoTrackSummary: {
    mediaType: videoTrack.mediaType,
    sampleCount: videoTrack.sampleCount,
    codec: videoTrack.codecConfig,
    meta: videoTrack.containerMeta
  },
  audioTrackSummary: {
    mediaType: audioTrack.mediaType,
    sampleCount: audioTrack.sampleCount,
    codec: audioTrack.codecConfig,
    meta: audioTrack.containerMeta
  },
  firstVideoSample: videoTrack.getSampleByIndex(0),
  firstAudioSample: audioTrack.getSampleByIndex(0)
})
```

## Best live subset

If you want to keep it short:

1. Load fixture
2. Import `getGoldenTruthBox`
3. Read `moov`
4. Read `tkhd`
5. Read `stbl`
6. Import `openContainerFromMp4`
7. Open the container
8. Create track views
9. Show video and audio track summaries
10. Show first sample objects

## Spoken framing

Use this framing:

- NativeMuxer is mainly an MP4 compiler.
- Underneath that, there is a structural extraction layer that can address MP4 boxes precisely.
- On top of that, there is a cleaner container facade that exposes tracks, codec config, metadata, and timed samples.
- This is the plumbing that higher-level tools depend on.
