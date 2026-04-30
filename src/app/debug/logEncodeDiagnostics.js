import { getGoldenTruthBox } from "../../mux/native/tests/goldenTruthExtractors/index.js";

export function logEncodeDiagnostics({
    videoEncodedChunks,
    audioEncodedChunks,
    result,
    exportRange,
    prerenderPlan
}) {
    const summarizeTiming = (timestamps) => {
        if (!Array.isArray(timestamps) || timestamps.length === 0) {
            return { count: 0 };
        }

        const deltas = [];
        for (let i = 1; i < timestamps.length; i++) {
            deltas.push(timestamps[i] - timestamps[i - 1]);
        }

        const deltaCounts = new Map();
        for (const delta of deltas) {
            deltaCounts.set(delta, (deltaCounts.get(delta) ?? 0) + 1);
        }

        const topDeltas = [...deltaCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([delta, count]) => ({ delta, count }));

        return {
            count: timestamps.length,
            first: timestamps[0],
            last: timestamps[timestamps.length - 1],
            uniqueDeltaCount: deltaCounts.size,
            minDelta: deltas.length > 0 ? Math.min(...deltas) : null,
            maxDelta: deltas.length > 0 ? Math.max(...deltas) : null,
            zeroDeltas: deltas.filter(d => d === 0).length,
            negativeDeltas: deltas.filter(d => d < 0).length,
            topDeltas,
            firstDeltas: deltas.slice(0, 30)
        };
    };

    const summarizePayloadSizes = (payloads) => {
        if (!Array.isArray(payloads) || payloads.length === 0) {
            return { count: 0 };
        }

        const sizes = payloads
            .map(payload => payload?.byteLength)
            .filter(size => Number.isInteger(size));

        if (sizes.length === 0) {
            return { count: 0 };
        }

        const total = sizes.reduce((sum, size) => sum + size, 0);
        return {
            count: sizes.length,
            min: Math.min(...sizes),
            max: Math.max(...sizes),
            avg: Math.round(total / sizes.length)
        };
    };

    const summarizeKeyMap = (accessUnits) => {
        if (!Array.isArray(accessUnits) || accessUnits.length === 0) {
            return { count: 0, trueCount: 0, falseCount: 0, unknownCount: 0 };
        }

        let trueCount = 0;
        let falseCount = 0;
        let unknownCount = 0;
        for (const unit of accessUnits) {
            const key = unit?.isKey ?? unit?.isKeyframe;
            if (key === true) trueCount++;
            else if (key === false) falseCount++;
            else unknownCount++;
        }

        return {
            count: accessUnits.length,
            trueCount,
            falseCount,
            unknownCount
        };
    };

    const convertSourceUnitPtsToUs = (unit) => {
        const pts = unit?.pts;
        if (typeof pts !== "number") return null;
        const trackView = unit?.clip?.trackView;
        if (trackView && typeof trackView.ptsToSeconds === "function") {
            return Math.round(trackView.ptsToSeconds(pts) * 1_000_000);
        }
        return Math.round(pts);
    };

    const classifySourceAccessUnit = (unit) => {
        const mediaType = unit?.clip?.trackView?.mediaType;
        if (mediaType === "video" || mediaType === "audio") {
            return mediaType;
        }
        return null;
    };

    const summarizeSourceAccessUnitsFromPlan = ({ plan, mediaType, rangeStartUs, rangeEndUs }) => {
        const fragments = Array.isArray(plan?.fragments) ? plan.fragments : [];
        const units = [];
        for (const fragment of fragments) {
            if (!Array.isArray(fragment?.access_units)) continue;
            for (const unit of fragment.access_units) {
                if (classifySourceAccessUnit(unit) !== mediaType) continue;
                const ptsUs = convertSourceUnitPtsToUs(unit);
                if (typeof ptsUs !== "number") continue;
                if (ptsUs < rangeStartUs || ptsUs > rangeEndUs) continue;
                units.push({ ...unit, ptsUs });
            }
        }
        units.sort((a, b) => a.ptsUs - b.ptsUs);

        return {
            count: units.length,
            timing: summarizeTiming(units.map(unit => unit.ptsUs)),
            keyMap: summarizeKeyMap(units),
            payloadSizes: summarizePayloadSizes(units.map(unit => unit?.data))
        };
    };

    const classifyExportTrackMediaType = (track) => {
        const codec = track?.semanticCore?.codec?.codec;
        if (typeof codec !== "string") return null;
        if (/^avc|^hev|^vp|^av01|^hvc|^vvc/i.test(codec)) return "video";
        if (/^opus|^mp4a|^aac|^ac-3|^ec-3/i.test(codec)) return "audio";
        return null;
    };

    const summarizeExportAccessUnitsFromMp4BuildInput = ({ mp4BuildInput, mediaType }) => {
        const tracks = Array.isArray(mp4BuildInput?.tracks) ? mp4BuildInput.tracks : [];
        const track = tracks.find(candidate => classifyExportTrackMediaType(candidate) === mediaType);
        if (!track) {
            return {
                count: 0,
                timing: { count: 0 },
                keyMap: { count: 0, trueCount: 0, falseCount: 0, unknownCount: 0 },
                payloadSizes: { count: 0 },
                codec: null
            };
        }

        const accessUnits = Array.isArray(track?.semanticCore?.accessUnits) ? track.semanticCore.accessUnits : [];
        const payloads = Array.isArray(track?.payloads?.accessUnitPayloads) ? track.payloads.accessUnitPayloads : [];

        return {
            count: accessUnits.length,
            timing: summarizeTiming(
                accessUnits
                    .map(unit => unit?.pts)
                    .filter(pts => typeof pts === "number")
            ),
            keyMap: summarizeKeyMap(accessUnits),
            payloadSizes: summarizePayloadSizes(payloads),
            codec: track?.semanticCore?.codec?.codec ?? null
        };
    };

    const summarizeDurationAgreement = ({ sourceSummary, exportSummary }) => {
        const sourceStart = sourceSummary?.timing?.first;
        const sourceEnd = sourceSummary?.timing?.last;
        const exportStart = exportSummary?.timing?.first;
        const exportEnd = exportSummary?.timing?.last;
        const sourceSpanUs = (typeof sourceStart === "number" && typeof sourceEnd === "number")
            ? (sourceEnd - sourceStart)
            : null;
        const exportSpanUs = (typeof exportStart === "number" && typeof exportEnd === "number")
            ? (exportEnd - exportStart)
            : null;
        return {
            sourceSpanUs,
            exportSpanUs,
            spanDeltaUs:
                (typeof sourceSpanUs === "number" && typeof exportSpanUs === "number")
                    ? (exportSpanUs - sourceSpanUs)
                    : null
        };
    };

    const videoChunkTiming = summarizeTiming(
        videoEncodedChunks
            .map(chunk => chunk?.timestamp)
            .filter(timestamp => typeof timestamp === "number")
    );
    const audioChunkTiming = summarizeTiming(
        audioEncodedChunks
            .map(chunk => chunk?.timestamp)
            .filter(timestamp => typeof timestamp === "number")
    );

    console.log("[Encode] encoded video chunk timing", videoChunkTiming);
    console.log("[Encode] encoded audio chunk timing", audioChunkTiming);
    console.log("[Encode] encoded video chunk timing JSON", JSON.stringify(videoChunkTiming));
    console.log("[Encode] encoded audio chunk timing JSON", JSON.stringify(audioChunkTiming));

    if (Array.isArray(result?.mp4BuildInput?.tracks)) {
        const trackTiming = result.mp4BuildInput.tracks.map((track, index) => {
            const accessUnits = track?.semanticCore?.accessUnits ?? track?.accessUnits ?? [];
            const pts = accessUnits
                .map(unit => unit?.pts)
                .filter(timestamp => typeof timestamp === "number");
            return {
                index,
                accessUnitCount: accessUnits.length,
                ptsSummary: summarizeTiming(pts)
            };
        });
        console.log("[Encode] mp4BuildInput track timing", trackTiming);
        console.log("[Encode] mp4BuildInput track timing JSON", JSON.stringify(trackTiming));

        const rangeStartUs = Math.round(exportRange.startSeconds * 1_000_000);
        const rangeEndUs = Math.round(exportRange.endSeconds * 1_000_000);
        const sourceVideoSummary = summarizeSourceAccessUnitsFromPlan({
            plan: prerenderPlan,
            mediaType: "video",
            rangeStartUs,
            rangeEndUs
        });
        const sourceAudioSummary = summarizeSourceAccessUnitsFromPlan({
            plan: prerenderPlan,
            mediaType: "audio",
            rangeStartUs,
            rangeEndUs
        });
        const exportVideoSummary = summarizeExportAccessUnitsFromMp4BuildInput({
            mp4BuildInput: result.mp4BuildInput,
            mediaType: "video"
        });
        const exportAudioSummary = summarizeExportAccessUnitsFromMp4BuildInput({
            mp4BuildInput: result.mp4BuildInput,
            mediaType: "audio"
        });

        const accessUnitInvariantReport = {
            source: {
                video: sourceVideoSummary,
                audio: sourceAudioSummary
            },
            export: {
                video: exportVideoSummary,
                audio: exportAudioSummary
            },
            agreement: {
                video: summarizeDurationAgreement({
                    sourceSummary: sourceVideoSummary,
                    exportSummary: exportVideoSummary
                }),
                audio: summarizeDurationAgreement({
                    sourceSummary: sourceAudioSummary,
                    exportSummary: exportAudioSummary
                })
            }
        };
        console.log("[Encode] access unit invariants", accessUnitInvariantReport);
        console.log("[Encode] access unit invariants JSON", JSON.stringify(accessUnitInvariantReport));
    }

    const summarizeSttsEntries = (entries) => {
        if (!Array.isArray(entries) || entries.length === 0) {
            return {
                entryCount: 0,
                totalSamples: 0,
                uniqueDeltas: []
            };
        }

        const totalSamples = entries.reduce((sum, entry) => {
            const sampleCount = Number.isInteger(entry?.sampleCount)
                ? entry.sampleCount
                : (Number.isInteger(entry?.count) ? entry.count : 0);
            return sum + sampleCount;
        }, 0);
        const uniqueDeltas = [...new Set(entries.map(entry => {
            if (Number.isInteger(entry?.sampleDelta)) return entry.sampleDelta;
            if (Number.isInteger(entry?.delta)) return entry.delta;
            return undefined;
        }))].filter(Number.isInteger);

        return {
            entryCount: entries.length,
            totalSamples,
            uniqueDeltas
        };
    };

    const summarizeCttsEntries = (entries) => {
        if (!Array.isArray(entries) || entries.length === 0) {
            return {
                entryCount: 0,
                totalSamples: 0,
                uniqueOffsets: []
            };
        }

        const totalSamples = entries.reduce(
            (sum, entry) => sum + (Number.isInteger(entry.count) ? entry.count : 0),
            0
        );
        const uniqueOffsets = [...new Set(entries.map(entry => entry.offset))].filter(Number.isInteger);

        return {
            entryCount: entries.length,
            totalSamples,
            uniqueOffsets
        };
    };

    if (result.mp4Bytes instanceof Uint8Array) {
        const readTrackBoxFields = (trackIndex, boxPathSuffix) => {
            const semanticBoxData = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
                result.mp4Bytes,
                `moov/trak[${trackIndex}]/mdia/minf/stbl/${boxPathSuffix}`
            );

            if (!semanticBoxData || semanticBoxData.found === false) {
                return null;
            }

            if (typeof semanticBoxData.readBoxReport !== "function") {
                return null;
            }

            const report = semanticBoxData.readBoxReport();
            return report?.box?.fields ?? null;
        };

        try {
            const videoStts = summarizeSttsEntries(readTrackBoxFields(0, "stts")?.entries);
            const videoCtts = summarizeCttsEntries(readTrackBoxFields(0, "ctts")?.entries);
            const videoStssFields = readTrackBoxFields(0, "stss");
            const videoSyncSamples = Array.isArray(videoStssFields?.sampleNumbers)
                ? videoStssFields.sampleNumbers.length
                : 0;

            const audioStts = summarizeSttsEntries(readTrackBoxFields(1, "stts")?.entries);

            const mp4BoxTimingSummary = {
                video: {
                    stts: videoStts,
                    ctts: videoCtts,
                    stssSyncSampleCount: videoSyncSamples
                },
                audio: {
                    stts: audioStts
                }
            };

            console.log("[Encode] mp4 box timing summary", mp4BoxTimingSummary);
            console.log("[Encode] mp4 box timing summary JSON", JSON.stringify(mp4BoxTimingSummary));
            console.log("[Encode] mp4 box raw fields JSON", JSON.stringify({
                video: {
                    stts: readTrackBoxFields(0, "stts"),
                    ctts: readTrackBoxFields(0, "ctts"),
                    stss: readTrackBoxFields(0, "stss")
                },
                audio: {
                    stts: readTrackBoxFields(1, "stts")
                }
            }));
        } catch (error) {
            console.error("[Encode] mp4 box timing summary failed", error);
        }
    }
}
