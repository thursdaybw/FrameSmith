import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

export function extractAccessUnitPayloadsFromMp4({ mp4Bytes, zeroBasedTrackIndex = 0, }) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "expected Uint8Array mp4Bytes" +
            "Received", typeof my4Bytes
        );
    }

    const stbl =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl`
            )
            .readBoxReport();

    const derived = stbl?.derived;
    if (!derived) {
        throw new Error("stbl.readBoxReport().derived missing");
    }

    const samples = derived.samplesOneSamplePerFrame;

    if (!Array.isArray(samples)) {
        throw new Error(`extractAccessUnitPayloadsFromMp4: derived samples missing.'`);
    }

    return samples.map(sample =>
        mp4Bytes.slice(
            sample.offset,
            sample.offset + sample.size
        )
    );
}
