import { DecodedContainerBackedFragmentBatch } from "./DecodedContainerBackedFragmentBatch.js";
import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../timeline/planFragments.js";

function normalizeTimestampUs(unit) {
    const clipTrackView = unit?.clip?.trackView;
    if (clipTrackView && typeof clipTrackView.ptsToSeconds === "function") {
        return Math.round(clipTrackView.ptsToSeconds(unit.pts) * 1_000_000);
    }
    return unit.pts;
}

function normalizeDurationUs(unit) {
    const clipTrackView = unit?.clip?.trackView;
    if (clipTrackView && typeof clipTrackView.ptsToSeconds === "function" && typeof unit.duration === "number") {
        return Math.max(1, Math.round(clipTrackView.ptsToSeconds(unit.duration) * 1_000_000));
    }
    return unit.duration;
}

function toWebCodecsVideoChunk(unit, { forceKeyframe = false } = {}) {
    if (typeof EncodedVideoChunk !== "function") return unit.data;
    if (!(unit.data instanceof Uint8Array)) return unit.data;

    const chunkType = (forceKeyframe || unit?.isKeyframe === true || unit?.isKey === true)
        ? "key"
        : "delta";
    return new EncodedVideoChunk({
        type: chunkType,
        timestamp: normalizeTimestampUs(unit),
        duration: normalizeDurationUs(unit),
        data: unit.data
    });
}

function toWebCodecsAudioChunk(unit) {
    if (typeof EncodedAudioChunk !== "function") return unit.data;
    if (!(unit.data instanceof Uint8Array)) return unit.data;

    return new EncodedAudioChunk({
        type: "key",
        timestamp: normalizeTimestampUs(unit),
        duration: normalizeDurationUs(unit),
        data: unit.data
    });
}

function appendDecodeResult(target, decodeResult, fallbackTimestamp) {
    if (Array.isArray(decodeResult)) {
        for (const item of decodeResult) {
            target.push(item);
        }
        return;
    }

    if (decodeResult && typeof decodeResult === "object") {
        target.push(decodeResult);
        return;
    }

    target.push({ timestamp: fallbackTimestamp });
}

function createFailure(message, cause) {
    const error = new Error(message);
    if (cause !== undefined) {
        error.cause = cause;
    }
    return error;
}

async function withTimeout({ label, promise, timeoutMs = 60000 }) {
    let timeoutId;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(`${label} timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            })
        ]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

function sortVideoUnitsByDecodeOrder(units) {
    return [...units].sort((a, b) => {
        const aDecodeTime = typeof a.dts === "number" ? a.dts : a.pts;
        const bDecodeTime = typeof b.dts === "number" ? b.dts : b.pts;
        return aDecodeTime - bDecodeTime;
    });
}

function unitIsKeyframe(unit) {
    if (!unit || typeof unit !== "object") return undefined;
    if (typeof unit.isKeyframe === "boolean") return unit.isKeyframe;
    if (typeof unit.isKey === "boolean") return unit.isKey;
    return undefined;
}

function trimVideoUnitsToFirstDecodableKeyframe(units) {
    const hasKeyInfo = units.some(unit => typeof unitIsKeyframe(unit) === "boolean");
    if (!hasKeyInfo) {
        return {
            decodeUnits: units,
            droppedLeadingUnits: 0,
            hasKeyInfo: false,
            forceFirstKeyframe: false
        };
    }

    const hasAnyKnownKeyframe = units.some(unit => unitIsKeyframe(unit) === true);
    if (!hasAnyKnownKeyframe) {
        return {
            decodeUnits: units,
            droppedLeadingUnits: 0,
            hasKeyInfo: true,
            forceFirstKeyframe: true
        };
    }

    const firstKeyIndex = units.findIndex(unit => unitIsKeyframe(unit) === true);
    return {
        decodeUnits: units.slice(firstKeyIndex),
        droppedLeadingUnits: firstKeyIndex,
        hasKeyInfo: true,
        forceFirstKeyframe: false
    };
}

function toHexByte(value) {
    return value.toString(16).padStart(2, "0").toUpperCase();
}

function formatFirstBytesHex(data, count = 8) {
    if (!(data instanceof Uint8Array) || data.length === 0) return "";
    const limit = Math.min(count, data.length);
    const parts = [];
    for (let index = 0; index < limit; index++) {
        parts.push(toHexByte(data[index]));
    }
    return parts.join(" ");
}

function inferPayloadFormat(data) {
    if (!(data instanceof Uint8Array) || data.length < 4) return "unknown";
    const b0 = data[0];
    const b1 = data[1];
    const b2 = data[2];
    const b3 = data[3];
    if (b0 === 0x00 && b1 === 0x00 && b2 === 0x01) return "annexb";
    if (b0 === 0x00 && b1 === 0x00 && b2 === 0x00 && b3 === 0x01) return "annexb";
    return "avcc";
}

function readAvccFirstNalLength(data) {
    if (!(data instanceof Uint8Array) || data.length < 4) return null;
    return (
        (data[0] << 24) |
        (data[1] << 16) |
        (data[2] << 8) |
        data[3]
    ) >>> 0;
}

function readAvccFirstNalType(data) {
    const firstNalLength = readAvccFirstNalLength(data);
    if (typeof firstNalLength !== "number") return null;
    if (firstNalLength <= 0) return null;
    if (data.length < 5) return null;
    if (firstNalLength > (data.length - 4)) return null;
    return data[4] & 0x1F;
}

function walkAvccNals(data) {
    if (!(data instanceof Uint8Array)) {
        return {
            payloadFormat: "unknown",
            nalCount: 0,
            malformed: true,
            malformedReason: "data-not-uint8array",
            nalTypes: [],
            hasVcl: false,
            hasIdr: false,
            hasNonIdrVcl: false
        };
    }

    const payloadFormat = inferPayloadFormat(data);
    if (payloadFormat !== "avcc") {
        return {
            payloadFormat,
            nalCount: 0,
            malformed: false,
            malformedReason: null,
            nalTypes: [],
            hasVcl: false,
            hasIdr: false,
            hasNonIdrVcl: false
        };
    }

    const nalTypes = [];
    let offset = 0;
    let malformed = false;
    let malformedReason = null;
    let hasVcl = false;
    let hasIdr = false;
    let hasNonIdrVcl = false;

    while (offset < data.length) {
        if ((offset + 4) > data.length) {
            malformed = true;
            malformedReason = "truncated-length-prefix";
            break;
        }

        const nalLength =
            ((data[offset] << 24) |
            (data[offset + 1] << 16) |
            (data[offset + 2] << 8) |
            data[offset + 3]) >>> 0;
        offset += 4;

        if (nalLength === 0) {
            malformed = true;
            malformedReason = "zero-length-nal";
            break;
        }

        if ((offset + nalLength) > data.length) {
            malformed = true;
            malformedReason = "nal-overruns-payload";
            break;
        }

        const nalHeader = data[offset];
        const nalType = nalHeader & 0x1F;
        nalTypes.push(nalType);

        if (nalType === 5) {
            hasVcl = true;
            hasIdr = true;
        } else if (nalType >= 1 && nalType <= 5) {
            hasVcl = true;
            hasNonIdrVcl = true;
        }

        offset += nalLength;
    }

    return {
        payloadFormat,
        nalCount: nalTypes.length,
        malformed,
        malformedReason,
        nalTypes,
        hasVcl,
        hasIdr,
        hasNonIdrVcl
    };
}

function logVideoAuProbe(units, { label }) {
    const sampleLimit = Math.min(10, units.length);
    let avccCount = 0;
    let annexbCount = 0;
    let invalidNalLengthCount = 0;
    let nonMonotonicDtsCount = 0;
    let ptsBeforeDtsCount = 0;
    let keyTrue = 0;
    let keyFalse = 0;
    let keyUnknown = 0;
    let idrCount = 0;
    let previousDts = null;

    for (const unit of units) {
        const data = unit?.data;
        const payloadFormat = inferPayloadFormat(data);
        if (payloadFormat === "avcc") avccCount++;
        if (payloadFormat === "annexb") annexbCount++;

        const firstNalLength = payloadFormat === "avcc" ? readAvccFirstNalLength(data) : null;
        if (payloadFormat === "avcc") {
            const payloadLength = data instanceof Uint8Array ? data.length : 0;
            const invalidNalLength =
                typeof firstNalLength !== "number" ||
                firstNalLength <= 0 ||
                firstNalLength > (payloadLength - 4);
            if (invalidNalLength) invalidNalLengthCount++;
        }

        const dts = typeof unit?.dts === "number" ? unit.dts : unit?.pts;
        if (typeof dts === "number") {
            if (typeof previousDts === "number" && dts < previousDts) {
                nonMonotonicDtsCount++;
            }
            previousDts = dts;
        }

        if (typeof unit?.pts === "number" && typeof dts === "number" && unit.pts < dts) {
            ptsBeforeDtsCount++;
        }

        const key = unitIsKeyframe(unit);
        if (key === true) keyTrue++;
        else if (key === false) keyFalse++;
        else keyUnknown++;

        const nalType = payloadFormat === "avcc" ? readAvccFirstNalType(data) : null;
        if (nalType === 5) idrCount++;
    }

    for (let index = 0; index < sampleLimit; index++) {
        const unit = units[index];
        const data = unit?.data;
        const payloadFormat = inferPayloadFormat(data);
        const firstNalLength = payloadFormat === "avcc" ? readAvccFirstNalLength(data) : null;
        const firstNalType = payloadFormat === "avcc" ? readAvccFirstNalType(data) : null;

        console.log(
            `[AUProbe][video][${label}] sample JSON`,
            JSON.stringify({
                index,
                pts: unit?.pts ?? null,
                dts: unit?.dts ?? null,
                duration: unit?.duration ?? null,
                isKeyframe: unitIsKeyframe(unit) ?? null,
                first8Hex: formatFirstBytesHex(data),
                inferredPayloadFormat: payloadFormat,
                firstNalLength,
                firstNalType
            })
        );
    }

    console.log(
        `[AUProbe][video][${label}] summary JSON`,
        JSON.stringify({
            count: units.length,
            avccCount,
            annexbCount,
            invalidNalLengthCount,
            nonMonotonicDtsCount,
            ptsBeforeDtsCount
        })
    );

    console.log(
        `[AUProbe][video][${label}] keymap JSON`,
        JSON.stringify({
            total: units.length,
            keyTrue,
            keyFalse,
            keyUnknown,
            idrCount
        })
    );
}

function logVideoAuNalWalkProbe(units, { label }) {
    const sampleLimit = Math.min(10, units.length);
    let avccSampleCount = 0;
    let annexbSampleCount = 0;
    let malformedNalRunCount = 0;
    let sampleHasIdrCount = 0;
    let sampleHasVclCount = 0;
    let declaredKeyframeButNoIdrCount = 0;
    let declaredDeltaButHasIdrCount = 0;
    let firstMalformedSampleIndex = null;

    for (let index = 0; index < units.length; index++) {
        const unit = units[index];
        const walk = walkAvccNals(unit?.data);
        const key = unitIsKeyframe(unit);

        if (walk.payloadFormat === "avcc") avccSampleCount++;
        if (walk.payloadFormat === "annexb") annexbSampleCount++;
        if (walk.hasIdr) sampleHasIdrCount++;
        if (walk.hasVcl) sampleHasVclCount++;

        if (walk.malformed) {
            malformedNalRunCount++;
            if (firstMalformedSampleIndex === null) {
                firstMalformedSampleIndex = index;
            }
        }

        if (key === true && !walk.hasIdr) {
            declaredKeyframeButNoIdrCount++;
        }
        if (key === false && walk.hasIdr) {
            declaredDeltaButHasIdrCount++;
        }
    }

    for (let index = 0; index < sampleLimit; index++) {
        const unit = units[index];
        const walk = walkAvccNals(unit?.data);
        console.log(
            `[AUProbe][video][${label}] nalwalk sample JSON`,
            JSON.stringify({
                index,
                pts: unit?.pts ?? null,
                dts: unit?.dts ?? null,
                duration: unit?.duration ?? null,
                isKeyframe: unitIsKeyframe(unit) ?? null,
                payloadFormat: walk.payloadFormat,
                nalCount: walk.nalCount,
                nalTypes: walk.nalTypes,
                hasVcl: walk.hasVcl,
                hasIdr: walk.hasIdr,
                hasNonIdrVcl: walk.hasNonIdrVcl,
                malformed: walk.malformed,
                malformedReason: walk.malformedReason
            })
        );
    }

    console.log(
        `[AUProbe][video][${label}] nalwalk summary JSON`,
        JSON.stringify({
            count: units.length,
            avccSampleCount,
            annexbSampleCount,
            malformedNalRunCount,
            sampleHasIdrCount,
            sampleHasVclCount,
            declaredKeyframeButNoIdrCount,
            declaredDeltaButHasIdrCount,
            firstMalformedSampleIndex
        })
    );
}

async function waitForDecoderCapacity({
    decoder,
    label,
    maxQueueSize = 32,
    timeoutMs = 30000,
    pollMs = 5
}) {
    if (!decoder || typeof decoder.decodeQueueSize !== "number") {
        return;
    }

    const waitStart = Date.now();
    while (decoder.decodeQueueSize >= maxQueueSize) {
        if (typeof decoder.getLastError === "function") {
            const decoderError = decoder.getLastError();
            if (decoderError) {
                throw createFailure(
                    `${label}: decoder reported error while waiting for capacity`,
                    decoderError
                );
            }
        }

        if ((Date.now() - waitStart) > timeoutMs) {
            throw new Error(
                `${label}: backpressure wait timed out after ${timeoutMs}ms ` +
                `(decodeQueueSize=${decoder.decodeQueueSize})`
            );
        }

        await new Promise(resolve => setTimeout(resolve, pollMs));
    }
}

/**
 * decodeContainerAccessUnitsFromPreRenderPlanBatch
 *
 * APPLICATION SERVICE — Decodes Container Backed Fragments. 
 *
 * This function selects walks fragments, selects container-backed ones,
 * feeds encoded chunks to WebCodecs, and produces decoded media-domain
 * artifacts.
 *
 * CURRENT SCOPE:
 * - Container-backed ACCESS-UNITS fragments
 * - Video and Audio domains (independently)
 */
export async function decodeContainerAccessUnitsFromPreRenderPlanBatch({
    plan,
    videoDecoder,
    audioDecoder
}) {

    if (!plan || !Array.isArray(plan.fragments)) {
        throw new Error(
            "decodeContainerAccessUnitsFromPreRenderPlanBatch: invalid plan. " +
            "Expected an object with a fragments array, " +
            `received ${plan === null ? "null" : typeof plan}`
        );
    }

    const decodedVideoFrames = [];
    const decodedAudioData = [];
    let routedVideoUnits = 0;
    let routedAudioUnits = 0;

    for (const fragment of plan.fragments) {

        if (
            fragment.kind === PreRenderPlanFragmentKinds.ACCESS_UNITS &&
            fragment.prerenderContributorKind ===
                PreRenderPlanContributorKinds.CONTAINER_TRACK
        ) {
            const videoUnits = [];
            const audioUnits = [];

            for (const unit of fragment.access_units) {
                const unitMediaType = unit?.clip?.trackView?.mediaType;
                const shouldRouteVideo =
                    unitMediaType === "video" || unitMediaType === undefined;
                const shouldRouteAudio =
                    unitMediaType === "audio" || unitMediaType === undefined;

                if (shouldRouteVideo) videoUnits.push(unit);
                if (shouldRouteAudio) audioUnits.push(unit);
            }

            // -------------------------------------------------
            // Video path (decode order)
            // -------------------------------------------------
            if (videoDecoder && typeof videoDecoder.decode === "function") {
                const orderedVideoUnits = sortVideoUnitsByDecodeOrder(videoUnits);
                const {
                    decodeUnits,
                    droppedLeadingUnits,
                    hasKeyInfo,
                    forceFirstKeyframe
                } = trimVideoUnitsToFirstDecodableKeyframe(orderedVideoUnits);

                console.log("[decodeContainerBatch] video decode input", {
                    totalVideoUnits: orderedVideoUnits.length,
                    decodeUnits: decodeUnits.length,
                    droppedLeadingUnits,
                    hasKeyInfo,
                    forceFirstKeyframe
                });
                logVideoAuProbe(decodeUnits, { label: "source" });
                logVideoAuNalWalkProbe(decodeUnits, { label: "source" });

                for (let index = 0; index < decodeUnits.length; index++) {
                    const unit = decodeUnits[index];
                    await waitForDecoderCapacity({
                        decoder: videoDecoder,
                        label: "decodeContainerBatch videoDecoder.decode"
                    });

                    routedVideoUnits++;
                    const fallbackTimestamp = normalizeTimestampUs(unit);
                    const decodeResult = videoDecoder.decode(
                        toWebCodecsVideoChunk(unit, {
                            forceKeyframe: forceFirstKeyframe && index === 0
                        })
                    );
                    appendDecodeResult(decodedVideoFrames, decodeResult, fallbackTimestamp);
                }
            }

            // -------------------------------------------------
            // Audio path
            // -------------------------------------------------
            if (audioDecoder && typeof audioDecoder.decode === "function") {
                for (const unit of audioUnits) {
                    await waitForDecoderCapacity({
                        decoder: audioDecoder,
                        label: "decodeContainerBatch audioDecoder.decode"
                    });

                    routedAudioUnits++;
                    const fallbackTimestamp = normalizeTimestampUs(unit);
                    const decodeResult = audioDecoder.decode(toWebCodecsAudioChunk(unit));
                    appendDecodeResult(decodedAudioData, decodeResult, fallbackTimestamp);
                }
            }
        }
    }

    console.log("[decodeContainerBatch] decode dispatch complete", {
        routedVideoUnits,
        routedAudioUnits,
        provisionalVideoOutputs: decodedVideoFrames.length,
        provisionalAudioOutputs: decodedAudioData.length
    });

    if (videoDecoder && typeof videoDecoder.getLastError === "function") {
        const decoderError = videoDecoder.getLastError();
        if (decoderError) {
            throw createFailure(
                "decodeContainerBatch: video decoder reported error before flush",
                decoderError
            );
        }
    }

    if (audioDecoder && typeof audioDecoder.getLastError === "function") {
        const decoderError = audioDecoder.getLastError();
        if (decoderError) {
            throw createFailure(
                "decodeContainerBatch: audio decoder reported error before flush",
                decoderError
            );
        }
    }

    // Flush decoders if present
    if (videoDecoder && typeof videoDecoder.flush === "function") {
        console.log("[decodeContainerBatch] videoDecoder.flush start");
        await withTimeout({
            label: "decodeContainerBatch videoDecoder.flush",
            promise: videoDecoder.flush()
        });
        console.log("[decodeContainerBatch] videoDecoder.flush complete");

        if (typeof videoDecoder.getLastError === "function") {
            const decoderError = videoDecoder.getLastError();
            if (decoderError) {
                throw createFailure(
                    "decodeContainerBatch: video decoder reported error during flush",
                    decoderError
                );
            }
        }
    }

    if (audioDecoder && typeof audioDecoder.flush === "function") {
        console.log("[decodeContainerBatch] audioDecoder.flush start");
        await withTimeout({
            label: "decodeContainerBatch audioDecoder.flush",
            promise: audioDecoder.flush()
        });
        console.log("[decodeContainerBatch] audioDecoder.flush complete");

        if (typeof audioDecoder.getLastError === "function") {
            const decoderError = audioDecoder.getLastError();
            if (decoderError) {
                throw createFailure(
                    "decodeContainerBatch: audio decoder reported error during flush",
                    decoderError
                );
            }
        }
    }

    if (videoDecoder && typeof videoDecoder.getDecodedOutputs === "function") {
        const outputs = videoDecoder.getDecodedOutputs();
        if (Array.isArray(outputs) && outputs.length > 0) {
            decodedVideoFrames.splice(0, decodedVideoFrames.length, ...outputs);
        }
    }

    if (audioDecoder && typeof audioDecoder.getDecodedOutputs === "function") {
        const outputs = audioDecoder.getDecodedOutputs();
        if (Array.isArray(outputs) && outputs.length > 0) {
            decodedAudioData.splice(0, decodedAudioData.length, ...outputs);
        }
    }

    return new DecodedContainerBackedFragmentBatch({
        decodedVideoFrames,
        decodedAudioData
    });
}
