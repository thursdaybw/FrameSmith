import { extractBoxByPathFromMp4 } from "./BoxExtractor.js";
import { readUint32 } from "../../bytes/mp4ByteReader.js";

/**
 * Extract access-unit byte payloads from a golden MP4.
 *
 * Output:
 *   Uint8Array[]  // index === sampleIndex
 */
import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

export function extractAccessUnitPayloadsFromMp4({
    mp4Bytes,
    trackIndex = 0
}) {
    const stbl =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${trackIndex}]/mdia/minf/stbl`
            )
            .readBoxReport();

    const samples = stbl.derived.samples;

    return samples.map(sample =>
        mp4Bytes.slice(
            sample.offset,
            sample.offset + sample.size
        )
    );
}
