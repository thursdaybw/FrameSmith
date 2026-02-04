import { composeFtypNode } from "../composers/composeFtypNode.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertEqual } from "./assertions.js";

export async function testNativeMuxer_FTYP_Equals_FFmpegOracle() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Compiler FTYP
    // ---------------------------------------------------------
    const compilerFtypNode = composeFtypNode();
    const compilerFtypBytes = serializeBoxTree(compilerFtypNode);

    // ---------------------------------------------------------
    // Oracle FTYP
    // ---------------------------------------------------------
    const oracleFtypBytes = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, "ftyp").readBoxReport().raw;

    // ---------------------------------------------------------
    // Byte-for-byte assertion
    // ---------------------------------------------------------
    for (let i = 0; i < compilerFtypBytes.length; i++) {
        if (compilerFtypBytes[i] !== oracleFtypBytes[i]) {
            throw new Error(
                `ftyp byte mismatch at offset ${i}\n` +
                `expected 0x${oracleFtypBytes[i].toString(16)}\n` +
                `actual   0x${compilerFtypBytes[i].toString(16)}`
            );
        }
    }

    assertEqual( "ftyp byte length", compilerFtypBytes.length, oracleFtypBytes.length);
}
