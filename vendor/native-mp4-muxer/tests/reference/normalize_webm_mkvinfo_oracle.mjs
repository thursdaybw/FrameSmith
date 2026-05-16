import fs from "node:fs";
import path from "node:path";

function parseTimestampToMs(text) {
  const match = /^([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{9})$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const nanos = Number(match[4]);
  const totalMs = ((hours * 3600) + (minutes * 60) + seconds) * 1000 + (nanos / 1_000_000);
  return Math.round(totalMs);
}

function toCodecName(codecId) {
  if (codecId === "V_VP9") {
    return "vp9";
  }
  if (codecId === "A_OPUS") {
    return "opus";
  }
  return codecId;
}

function summarizePacketsForTrack({ packets, forceAllKeyframes }) {
  if (packets.length === 0) {
    return {
      packetCount: 0,
      keyframeCount: 0,
      firstPts: null,
      lastPts: null,
      minDuration: null,
      maxDuration: null,
      nonMonotonicPtsCount: 0
    };
  }

  let keyframeCount = 0;
  let nonMonotonicPtsCount = 0;
  let minDuration = null;
  let maxDuration = null;

  for (let index = 0; index < packets.length; index++) {
    const packet = packets[index];
    if (forceAllKeyframes || packet.isKeyframe === true) {
      keyframeCount += 1;
    }

    if (index > 0) {
      const previous = packets[index - 1];
      if (packet.pts < previous.pts) {
        nonMonotonicPtsCount += 1;
      }
      const delta = packet.pts - previous.pts;
      if (delta > 0) {
        if (minDuration === null || delta < minDuration) {
          minDuration = delta;
        }
        if (maxDuration === null || delta > maxDuration) {
          maxDuration = delta;
        }
      }
    }
  }

  return {
    packetCount: packets.length,
    keyframeCount,
    firstPts: packets[0].pts,
    lastPts: packets[packets.length - 1].pts,
    minDuration,
    maxDuration,
    nonMonotonicPtsCount
  };
}

function normalizeFromMkvinfoText(mkvinfoText) {
  const lines = mkvinfoText.split(/\r?\n/);

  let segmentDurationMs = null;
  let timestampScaleNs = null;
  let segmentDeclaredSizeBytes = null;

  const tracks = [];
  let currentTrack = null;
  let withinTracksSection = false;

  const packetsByTrackNumber = new Map();

  for (const line of lines) {
    if (line.startsWith("+ Segment: size ")) {
      const value = Number(line.slice("+ Segment: size ".length).trim());
      if (Number.isFinite(value)) {
        segmentDeclaredSizeBytes = value;
      }
      continue;
    }

    if (line.includes("|+ Segment information")) {
      withinTracksSection = false;
      continue;
    }

    const durationMatch = line.match(/\| \+ Duration: ([0-9:.]+)$/);
    if (durationMatch) {
      const parsed = parseTimestampToMs(durationMatch[1]);
      if (parsed !== null) {
        segmentDurationMs = parsed;
      }
      continue;
    }

    const timestampScaleMatch = line.match(/\| \+ Timestamp scale: ([0-9]+)$/);
    if (timestampScaleMatch) {
      const value = Number(timestampScaleMatch[1]);
      if (Number.isFinite(value) && value > 0) {
        timestampScaleNs = value;
      }
      continue;
    }

    if (line.includes("|+ Tracks")) {
      withinTracksSection = true;
      currentTrack = null;
      continue;
    }

    if (withinTracksSection && line.includes("|+ Tags")) {
      withinTracksSection = false;
      currentTrack = null;
      continue;
    }

    if (withinTracksSection && /^\| \+ Track$/.test(line.trim())) {
      currentTrack = {
        index: tracks.length,
        trackNumber: null,
        codecType: null,
        codecId: null,
        codecName: null,
        codecTagString: null,
        timeBase: "1/1000",
        width: null,
        height: null,
        sampleRate: null,
        channels: null
      };
      tracks.push(currentTrack);
      continue;
    }

    if (withinTracksSection && currentTrack) {
      const trackNumberMatch = line.match(/Track number: ([0-9]+)/);
      if (trackNumberMatch) {
        currentTrack.trackNumber = Number(trackNumberMatch[1]);
        continue;
      }

      const codecIdMatch = line.match(/Codec ID: ([A-Za-z0-9_]+)/);
      if (codecIdMatch) {
        currentTrack.codecId = codecIdMatch[1];
        currentTrack.codecName = toCodecName(currentTrack.codecId);
        continue;
      }

      const trackTypeMatch = line.match(/Track type: (video|audio)/);
      if (trackTypeMatch) {
        currentTrack.codecType = trackTypeMatch[1];
        continue;
      }

      const widthMatch = line.match(/Pixel width: ([0-9]+)/);
      if (widthMatch) {
        currentTrack.width = Number(widthMatch[1]);
        continue;
      }

      const heightMatch = line.match(/Pixel height: ([0-9]+)/);
      if (heightMatch) {
        currentTrack.height = Number(heightMatch[1]);
        continue;
      }

      const sampleRateMatch = line.match(/Sampling frequency: ([0-9]+)/);
      if (sampleRateMatch) {
        currentTrack.sampleRate = Number(sampleRateMatch[1]);
        continue;
      }

      const channelsMatch = line.match(/Channels: ([0-9]+)/);
      if (channelsMatch) {
        currentTrack.channels = Number(channelsMatch[1]);
      }
    }

    const simpleBlockMatch = line.match(/Simple block: (?:key, )?track number ([0-9]+), [0-9]+ frame\(s\), timestamp ([0-9:.]+)/);
    const blockMatch = line.match(/\+ Block: track number ([0-9]+), [0-9]+ frame\(s\), timestamp ([0-9:.]+)/);

    let blockTrackNumber = null;
    let blockTimestamp = null;
    let isKeyframe = false;

    if (simpleBlockMatch) {
      blockTrackNumber = Number(simpleBlockMatch[1]);
      blockTimestamp = parseTimestampToMs(simpleBlockMatch[2]);
      isKeyframe = line.includes("Simple block: key,");
    } else if (blockMatch) {
      blockTrackNumber = Number(blockMatch[1]);
      blockTimestamp = parseTimestampToMs(blockMatch[2]);
      isKeyframe = false;
    }

    if (blockTrackNumber !== null && blockTimestamp !== null) {
      if (!packetsByTrackNumber.has(blockTrackNumber)) {
        packetsByTrackNumber.set(blockTrackNumber, []);
      }
      packetsByTrackNumber.get(blockTrackNumber).push({
        pts: blockTimestamp,
        isKeyframe
      });
    }
  }

  const packetSummary = tracks.map((track) => {
    const packets = packetsByTrackNumber.get(track.trackNumber) ?? [];
    const forceAllKeyframes = track.codecType === "audio";
    const summary = summarizePacketsForTrack({ packets, forceAllKeyframes });
    return {
      streamIndex: track.index,
      trackNumber: track.trackNumber,
      ...summary
    };
  });

  return {
    generator: {
      tool: "normalize_webm_mkvinfo_oracle.mjs",
      source: "mkvinfo -a -v --ui-language en_US"
    },
    format: {
      filename: null,
      formatName: "matroska,webm",
      formatLongName: "Matroska / WebM",
      durationSeconds: segmentDurationMs === null ? null : (segmentDurationMs / 1000),
      sizeBytes: segmentDeclaredSizeBytes,
      bitRate: null,
      timestampScaleNs
    },
    streamSummary: tracks,
    packetSummary
  };
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error(
    "Usage: node normalize_webm_mkvinfo_oracle.mjs <input-mkvinfo-text> <output-normalized-json>"
  );
  process.exit(1);
}

const resolvedInput = path.resolve(inputPath);
const resolvedOutput = path.resolve(outputPath);

const mkvinfoText = fs.readFileSync(resolvedInput, "utf8");
const normalized = normalizeFromMkvinfoText(mkvinfoText);

fs.writeFileSync(resolvedOutput, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
console.log(`wrote ${resolvedOutput}`);
