import fs from "node:fs";
import path from "node:path";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function summarizePacketsForStream(packets, streamIndex) {
  const streamPackets = packets.filter((p) => Number(p?.stream_index) === streamIndex);

  let keyframeCount = 0;
  let nonMonotonicPtsCount = 0;
  let lastPts = null;
  let minDuration = null;
  let maxDuration = null;

  for (const packet of streamPackets) {
    const flags = typeof packet?.flags === "string" ? packet.flags : "";
    if (flags.includes("K")) {
      keyframeCount += 1;
    }

    const pts = toNumber(packet?.pts);
    if (pts !== null && lastPts !== null && pts < lastPts) {
      nonMonotonicPtsCount += 1;
    }
    if (pts !== null) {
      lastPts = pts;
    }

    const duration = toNumber(packet?.duration);
    if (duration !== null) {
      if (minDuration === null || duration < minDuration) minDuration = duration;
      if (maxDuration === null || duration > maxDuration) maxDuration = duration;
    }
  }

  const firstPts = streamPackets.length > 0 ? toNumber(streamPackets[0]?.pts) : null;
  const finalPts = streamPackets.length > 0 ? toNumber(streamPackets[streamPackets.length - 1]?.pts) : null;

  return {
    streamIndex,
    packetCount: streamPackets.length,
    keyframeCount,
    firstPts,
    lastPts: finalPts,
    minDuration,
    maxDuration,
    nonMonotonicPtsCount
  };
}

function normalize(ffprobeJson) {
  const streams = Array.isArray(ffprobeJson?.streams) ? ffprobeJson.streams : [];
  const packets = Array.isArray(ffprobeJson?.packets) ? ffprobeJson.packets : [];
  const format = ffprobeJson?.format ?? {};

  const streamSummary = streams.map((stream) => ({
    index: Number(stream?.index),
    codecType: stream?.codec_type ?? null,
    codecName: stream?.codec_name ?? null,
    codecTagString: stream?.codec_tag_string ?? null,
    timeBase: stream?.time_base ?? null,
    width: toNumber(stream?.width),
    height: toNumber(stream?.height),
    sampleRate: toNumber(stream?.sample_rate),
    channels: toNumber(stream?.channels)
  }));

  const packetSummary = streamSummary.map((stream) => summarizePacketsForStream(packets, stream.index));

  return {
    generator: {
      tool: "normalize_webm_ffprobe_oracle.mjs",
      source: "ffprobe -show_format -show_streams -show_packets"
    },
    format: {
      filename: format?.filename ?? null,
      formatName: format?.format_name ?? null,
      formatLongName: format?.format_long_name ?? null,
      durationSeconds: toNumber(format?.duration),
      sizeBytes: toNumber(format?.size),
      bitRate: toNumber(format?.bit_rate)
    },
    streamSummary,
    packetSummary
  };
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error(
    "Usage: node normalize_webm_ffprobe_oracle.mjs <input-ffprobe-json> <output-normalized-json>"
  );
  process.exit(1);
}

const resolvedInput = path.resolve(inputPath);
const resolvedOutput = path.resolve(outputPath);

const ffprobeText = fs.readFileSync(resolvedInput, "utf8");
const ffprobeJson = JSON.parse(ffprobeText);
const normalized = normalize(ffprobeJson);

fs.writeFileSync(resolvedOutput, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
console.log(`wrote ${resolvedOutput}`);
