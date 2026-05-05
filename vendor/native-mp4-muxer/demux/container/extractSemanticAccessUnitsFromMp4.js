import { getGoldenTruthBox } from "../../tests/goldenTruthExtractors/index.js";

export function extractSemanticAccessUnitsFromMp4({ mp4Bytes, zeroBasedTrackIndex }) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "extractSemanticAccessUnitsFromMp4: invalid mp4Bytes. " +
            `Expected Uint8Array, got ${Object.prototype.toString.call(mp4Bytes)}`
        );
    }

    if (typeof zeroBasedTrackIndex !== "number") {
        throw new Error(
            "extractSemanticAccessUnitsFromMp4: invalid zeroBasedTrackIndex. " +
            `Expected number, got ${Object.prototype.toString.call(zeroBasedTrackIndex)}`
        );
    }

    const stbl = getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl`
            )
            .readBoxReport();

    if (!stbl) {
        throw new Error(
            "extractSemanticAccessUnitsFromMp4: failed to read STBL. " +
            `Track index: ${zeroBasedTrackIndex}`
        );
    }

    const derived = stbl.derived;

    if (!derived) {
        throw new Error(
            "extractSemanticAccessUnitsFromMp4: stbl.derived missing. " +
            `Track index: ${zeroBasedTrackIndex}, stbl keys: ${Object.keys(stbl).join(", ")}`
        );
    }

    const samples = derived.samplesOneSamplePerFrame;

    if (!Array.isArray(samples)) {
        throw new Error(
            "extractSemanticAccessUnitsFromMp4: derived.samplesOneSamplePerFrame invalid. " +
            `Got ${Object.prototype.toString.call(samples)}, ` +
            `derived keys: ${Object.keys(derived).join(", ")}`
        );
    }

    return samples.map(sample => {
        const sampleIsKey =
            (typeof sample.isKey === "boolean")
                ? sample.isKey
                : (typeof sample.isSync === "boolean" ? sample.isSync : undefined);

        const accessUnit = {
            pts: sample.pts,
            dts: sample.dts,
            duration: sample.duration,
            offset: sample.offset,
            size: sample.size,
            isKey: sampleIsKey
        };

        if (Number.isInteger(sample.packetIndex)) {
           accessUnit.packetIndex = sample.packetIndex;
        }

        return accessUnit;
    });

}
