import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

export function extractSemanticAccessUnitsFromMp4({ mp4Bytes, trackIndex = 0, }) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("expected Uint8Array mp4Bytes");
    }

    const stbl =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${trackIndex}]/mdia/minf/stbl`
            )
            .readBoxReport();

    const derived = stbl?.derived;

    if (!derived) {
        throw new Error("stbl.readBoxReport().derived missing");
    }

    const samples = derived.samplesOneSamplePerFrame;

    if (!Array.isArray(samples)) {
        throw new Error(`derived samples missing for layout '${layout}'.` + console.log("samples", samples));
    }

    return samples.map(sample => ({
        pts: sample.pts,
        dts: sample.dts,
        duration: sample.duration,
        size: sample.size,
        isKey: sample.isSync,
        packetIndex: sample.packetIndex
    }));
}
