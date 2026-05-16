import { composeFreeNode } from "../composers/composeFreeNode.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertEqual } from "./assertions.js";

export async function testNativeMuxer_FREE_Equals_FFmpegOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Compiler FREE
    // ---------------------------------------------------------
    const compilerFreeNode = composeFreeNode();
    const compilerFreeBytes = serializeBoxTree(compilerFreeNode);

    // ---------------------------------------------------------
    // Oracle FREE
    // ---------------------------------------------------------
    const oracleFreeBytes = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, "free")
        .readBoxReport()
        .raw;

    // ---------------------------------------------------------
    // Byte-for-byte assertion
    // ---------------------------------------------------------
    for (let i = 0; i < compilerFreeBytes.length; i++) {
        if (compilerFreeBytes[i] !== oracleFreeBytes[i]) {
            throw new Error(
                `free byte mismatch at offset ${i}\n` +
                `expected 0x${oracleFreeBytes[i].toString(16)}\n` +
                `actual   0x${compilerFreeBytes[i].toString(16)}`
            );
        }
    }

    assertEqual("free byte length", compilerFreeBytes.length, oracleFreeBytes.length);

    // ---------------------------------------------------------
    // Canonical invariant
    // ---------------------------------------------------------
    assertEqual("free box is exactly 8 bytes", compilerFreeBytes.length, 8);
}
