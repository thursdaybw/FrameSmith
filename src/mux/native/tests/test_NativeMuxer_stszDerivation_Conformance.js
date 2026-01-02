import { deriveStszSizesFromPayloads } from "../derivers/deriveStszSizesFromPayloads.js";
import { emitStszBox } from "../box-emitters/stszBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";
import { assertEqualHex, assertEqual } from "./assertions.js";
import { extractAccessUnitPayloadsFromMp4 } from "../tests/reference/extractAccessUnitPayloadsFromMp4.js";

export async function testNativeMuxer_DeriveStsz_Conformance_ffmpeg() {

    console.log(
        "=== testNativeMuxer_StszAdapter_Conformance_ffmpeg ==="
    );

    // ---------------------------------------------------------
    // Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Extract semantic samples (oracle)
    // ---------------------------------------------------------
    const accessUnits =
        extractSemanticAccessUnitsFromMp4({ mp4Bytes: mp4 });

    const accessUnitPayloads =
        extractAccessUnitPayloadsFromMp4({ mp4Bytes: mp4 });

    // ---------------------------------------------------------
    // Derive → emit
    // ---------------------------------------------------------
    const params =
        deriveStszSizesFromPayloads({
            accessUnits,
            accessUnitPayloads
        });

    const outBytes = serializeBoxTree(
        emitStszBox(params)
    );

    // ---------------------------------------------------------
    // Extract reference STSZ
    // ---------------------------------------------------------
    const refBytes = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsz"
    );

    assertEqual(
        "stsz.size",
        outBytes.length,
        refBytes.length
    );

    for (let i = 0; i < refBytes.length; i++) {
        assertEqualHex(
            `stsz.byte[${i}]`,
            outBytes[i],
            refBytes[i]
        );
    }

    console.log(
        "PASS: STSZ adapter + emitter reproduce ffmpeg output byte-for-byte"
    );
}
