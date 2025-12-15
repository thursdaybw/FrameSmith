import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { buildPaspBox } from "../boxes/stsdBox/paspBox.js";
import {
    readUint32FromMp4BoxBytes,
    readBoxTypeFromMp4BoxBytes
} from "./testUtils.js";
import {
    extractBoxByPath,
    extractSampleEntry,
    extractChildBoxFromSampleEntry
} from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

export async function testPasp_Structure() {
    console.log("=== pasp Granular structural tests ===");

    const box = serializeBoxTree(buildPaspBox());

    assertEqual("pasp.size", box.length, 16);
    assertEqual(
        "pasp.size field",
        readUint32FromMp4BoxBytes(box, 0),
        16
    );

    assertEqual(
        "pasp.type",
        readBoxTypeFromMp4BoxBytes(box, 4),
        "pasp"
    );

    assertEqual(
        "pasp.hSpacing",
        readUint32FromMp4BoxBytes(box, 8),
        1
    );

    assertEqual(
        "pasp.vSpacing",
        readUint32FromMp4BoxBytes(box, 12),
        1
    );

    console.log("PASS: pasp granular structural tests");
}

export async function testPasp_Conformance() {
    console.log("=== testPasp_Conformance (golden MP4) ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const stsdBox = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "stbl", "stsd"]
    );

    const avc1Box = extractSampleEntry(stsdBox, "avc1");
    const refPasp = extractChildBoxFromSampleEntry(avc1Box, "pasp");

    const outRaw = serializeBoxTree(
        buildPaspBox({
            hSpacing: readUint32FromMp4BoxBytes(refPasp, 8),
            vSpacing: readUint32FromMp4BoxBytes(refPasp, 12)
        })
    );

    assertEqual(
        "pasp.size",
        outRaw.length,
        refPasp.length
    );

    for (let i = 0; i < refPasp.length; i++) {
        assertEqual(
            `pasp.byte[${i}]`,
            outRaw[i],
            refPasp[i]
        );
    }

    console.log("PASS: pasp matches golden MP4");
}
