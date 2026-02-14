import { DecodedContainerBackedFragmentBatch } from "../DecodedContainerBackedFragmentBatch.js";

function closeArtifacts(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        if (item && typeof item.close === "function") {
            try {
                item.close();
            } catch {
                // Best-effort cleanup only.
            }
        }
    }
}

function ensureFiniteTimestamp(item, label) {
    const timestamp = Number(item?.timestamp);
    if (!Number.isFinite(timestamp)) {
        throw new Error(`${label}: item.timestamp must be finite`);
    }
}

function sortByTimestamp(items) {
    return [...items].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
}

export function createMediaElementDecodePort({
    mediaElementDriver
} = {}) {
    if (!mediaElementDriver || typeof mediaElementDriver.decodeVideoFrames !== "function") {
        throw new Error("createMediaElementDecodePort: mediaElementDriver.decodeVideoFrames is required");
    }

    return {
        async decodeRange({ plan, exportRange }) {
            const startSeconds = Number(exportRange?.startSeconds);
            const endSeconds = Number(exportRange?.endSeconds);
            if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
                throw new Error("MediaElementDecodePort.decodeRange: exportRange must contain numeric startSeconds/endSeconds");
            }

            let decodedVideoFrames = [];
            let decodedAudioData = [];

            try {
                const video = await mediaElementDriver.decodeVideoFrames({
                    plan,
                    exportRange
                });
                decodedVideoFrames = Array.isArray(video) ? video : [];
                for (const frame of decodedVideoFrames) {
                    ensureFiniteTimestamp(frame, "MediaElementDecodePort.decodeRange video");
                }
                decodedVideoFrames = sortByTimestamp(decodedVideoFrames);

                if (typeof mediaElementDriver.decodeAudioData === "function") {
                    const audio = await mediaElementDriver.decodeAudioData({
                        plan,
                        exportRange
                    });
                    decodedAudioData = Array.isArray(audio) ? audio : [];
                    for (const audioData of decodedAudioData) {
                        ensureFiniteTimestamp(audioData, "MediaElementDecodePort.decodeRange audio");
                    }
                    decodedAudioData = sortByTimestamp(decodedAudioData);
                }
            } catch (error) {
                closeArtifacts(decodedVideoFrames);
                closeArtifacts(decodedAudioData);
                throw new Error(
                    "MediaElementDecodePort.decodeRange failed " +
                    `(startSeconds=${startSeconds}, endSeconds=${endSeconds}): ` +
                    `${error?.message ?? String(error)}`
                );
            }

            return new DecodedContainerBackedFragmentBatch({
                decodedVideoFrames,
                decodedAudioData
            });
        }
    };
}

