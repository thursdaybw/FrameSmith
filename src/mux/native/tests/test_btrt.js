import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { buildBtrtBox } from "../boxes/stsdBox/btrtBox.js";
import { assertEqual } from "./assertions.js";
import {
    readUint32FromMp4BoxBytes,
    readBoxTypeFromMp4BoxBytes
} from "./testUtils.js";
import {
    extractBoxByPath,
    extractSampleEntry,
    extractChildBoxFromSampleEntry
} from "./reference/BoxExtractor.js";

export async function testBtrt_Structure() {
    console.log("=== btrt Granular structural tests ===");

    const box = serializeBoxTree(
        buildBtrtBox({
            bufferSizeDB: 0,
            maxBitrate: 0,
            avgBitrate: 0
        })
    );

    const expectedSize = 20;
    const actualSize   = box.length;

    assertEqual("btrt.size", actualSize, expectedSize);

    const sizeField = readUint32FromMp4BoxBytes(box, 0);
    assertEqual("btrt.sizeField", sizeField, expectedSize);

    const type = readBoxTypeFromMp4BoxBytes(box, 4);
    assertEqual("btrt.type", type, "btrt");

    const bufferSizeDB = readUint32FromMp4BoxBytes(box, 8);
    const maxBitrate   = readUint32FromMp4BoxBytes(box, 12);
    const avgBitrate   = readUint32FromMp4BoxBytes(box, 16);

    if (bufferSizeDB !== 0 || maxBitrate !== 0 || avgBitrate !== 0) {
        throw new Error("FAIL: btrt default values incorrect");
    }

    console.log("PASS: btrt granular structural tests");
}

export async function testBtrt_Conformance() {
    console.log("=== testBtrt_Conformance (golden MP4) ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const stsdBox = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "stbl", "stsd"]
    );

    const avc1Box = extractSampleEntry(stsdBox, "avc1");
    const refBtrt = extractChildBoxFromSampleEntry(avc1Box, "btrt");

    const ref = {
        bufferSizeDB: readUint32FromMp4BoxBytes(refBtrt, 8),
        maxBitrate:   readUint32FromMp4BoxBytes(refBtrt, 12),
        avgBitrate:   readUint32FromMp4BoxBytes(refBtrt, 16),
        raw:          refBtrt
    };

    const outRaw = serializeBoxTree(
        buildBtrtBox({
            bufferSizeDB: ref.bufferSizeDB,
            maxBitrate:   ref.maxBitrate,
            avgBitrate:   ref.avgBitrate
        })
    );

    assertEqual("btrt.length", ref.raw.length, outRaw.length);

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `btrt.byte[${i}]`,
            outRaw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: btrt matches golden MP4");
}
