import { buildStsdBox } from "../boxes/stsdBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    readUint32FromMp4BoxBytes,
    readUint16FromMp4BoxBytes,
    readBoxTypeFromMp4BoxBytes
} from "./testUtils.js";

import { extractBoxByPath, extractSampleEntry } from "./reference/BoxExtractor.js";
import { SampleEntryReader } from "./reference/SampleEntryReader.js";
import { assertEqual, assertExists } from "./assertions.js";

export async function testStsd_Structure() {

    console.log("=== testStsd_Structure (Phase A) ===");

    const width  = 1920;
    const height = 1080;

    const avcC = Uint8Array.from([1, 2, 3, 4]);

    const btrt = {
        bufferSize: 0,
        maxBitrate: 31504,
        avgBitrate: 31504
    };

    const node = buildStsdBox({
        width,
        height,
        codec: "avc1",
        avcC,
        compressorName: "",
        btrt
    });

    const serialized = serializeBoxTree(node);

    // ------------------------------------------------------------
    // 1. Box identity
    // ------------------------------------------------------------
    assertEqual("stsd.type", node.type, "stsd");
    assertEqual("stsd.version", node.version, 0);
    assertEqual("stsd.flags", node.flags, 0);

    // ------------------------------------------------------------
    // 2. Body layout
    // ------------------------------------------------------------
    assertEqual("stsd.body_is_array", Array.isArray(node.body), true);
    assertEqual("stsd.body.length", node.body.length, 1);

    assertEqual("stsd.children_is_array", Array.isArray(node.children), true);
    assertEqual("stsd.children.length", node.children.length, 1);

    assertEqual(
        "stsd.child.type",
        node.children[0].type,
        "avc1"
    );

    // ------------------------------------------------------------
    // 3. entry_count
    // ------------------------------------------------------------
    const entryCount = node.body[0];

    assertEqual(
        "stsd.entry_count.is_int",
        "int" in entryCount,
        true
    );

    assertEqual(
        "stsd.entry_count",
        entryCount.int,
        1
    );

    // ------------------------------------------------------------
    // 4. Sample entry (avc1)
    // ------------------------------------------------------------
    const sampleEntry = node.children[0];

    assertEqual(
        "stsd.sample_entry_is_object",
        typeof sampleEntry === "object" && sampleEntry !== null,
        true
    );

    assertEqual(
        "stsd.sample_entry.type",
        sampleEntry.type,
        "avc1"
    );

    assertEqual(
        "avc1.body_is_array",
        Array.isArray(sampleEntry.body),
        true
    );

    // ------------------------------------------------------------
    // 5. Child boxes must exist
    // ------------------------------------------------------------
    assertEqual(
        "avc1.children_is_array",
        Array.isArray(sampleEntry.children),
        true
    );

    const childTypes = sampleEntry.children.map(b => b.type);

    for (const required of ["avcC", "pasp", "btrt"]) {
        assertEqual(
            `avc1.child_present.${required}`,
            childTypes.includes(required),
            true
        );
    }

    // ------------------------------------------------------------
    // 6. Immutability
    // ------------------------------------------------------------
    avcC[0] = 99;

    const avcCBox = sampleEntry.children.find(b => b.type === "avcC");
    assertExists("avcC.box", avcCBox);

    assertEqual(
        "avcC.immutability",
        avcCBox.body[0].array?.values?.[0] !== 99,
        true
    );

    // ------------------------------------------------------------
    // 7. Sample Entry Traversibility
    // ------------------------------------------------------------
    let discovered;
    try {
        discovered = extractSampleEntry(serialized, "avc1");
    } catch (err) {
        throw new Error(
            "FAIL: stsd structure invalid\n" +
            "Reason: declared avc1 sample entry is not discoverable\n" +
            err.message
        );
    }

    assertEqual(
        "stsd.traversal.avc1_exists",
        !!discovered && discovered.length >= 8,
        true
    );

    // ------------------------------------------------------------
    // 8. Generic traversal invariants
    // ------------------------------------------------------------
    let discoveredAvc1;
    try {
        discoveredAvc1 = extractSampleEntry(serialized, "avc1");
    } catch (err) {
        throw new Error(
            "FAIL: stsd structure is not generically traversable\n" +
            err.message
        );
    }

    assertEqual(
        "stsd.generic_traversal.non_empty",
        discoveredAvc1.length > 0,
        true
    );

    console.log("PASS: stsd Phase A structural correctness");
}

async function buildReferenceAndOutputStsd() {
    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const refStsd = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "stbl", "stsd"]
    );

    if (!refStsd) {
        throw new Error("FAIL: stsd box not found in golden MP4");
    }

    const refAvc1 = extractSampleEntry(refStsd, "avc1");
    const refReader = new SampleEntryReader(refAvc1, 86);

    const refAvcC  = refReader.getChild("avcC");
    const refPasp  = refReader.getChild("pasp");
    const refBtrt  = refReader.getChild("btrt");

    const refBtrtFields = {
        bufferSize: readUint32FromMp4BoxBytes(refBtrt, 8),
        maxBitrate: readUint32FromMp4BoxBytes(refBtrt, 12),
        avgBitrate: readUint32FromMp4BoxBytes(refBtrt, 16)
    };

    const refCompressorName = readCompressorName(refAvc1);

    const node = buildStsdBox({
        width:  readUint16FromMp4BoxBytes(refAvc1, 32),
        height: readUint16FromMp4BoxBytes(refAvc1, 34),
        codec:  "avc1",
        avcC:   refAvcC.slice(8),
        compressorName: refCompressorName,
        btrt:   refBtrtFields
    });

    const outStsd = serializeBoxTree(node);

    return {
        refStsd,
        refAvc1,
        refAvcC,
        refPasp,
        refBtrt,
        outStsd
    };
}

export async function testStsd_SemanticConformance() {
    console.log("=== testStsd_SemanticConformance (golden MP4) ===");

    const {
        refAvc1,
        refAvcC,
        refPasp,
        refBtrt,
        outStsd
    } = await buildReferenceAndOutputStsd();

    const outAvc1 = extractSampleEntry(outStsd, "avc1");
    const outReader = new SampleEntryReader(outAvc1, 86);

    const outAvcC = outReader.getChild("avcC");
    const outPasp = outReader.getChild("pasp");
    const outBtrt = outReader.getChild("btrt");

    // ---- presence ----
    assertExists("avcC", outAvcC);
    assertExists("pasp", outPasp);
    assertExists("btrt", outBtrt);

    // ---- avcC payload ----
    assertEqual("avcC.size", outAvcC.length, refAvcC.length);

    for (let i = 0; i < refAvcC.length; i++) {
        assertEqual(
            `avcC.byte[${i}]`,
            outAvcC[i],
            refAvcC[i]
        );
    }

    // ---- pasp ----
    assertEqual(
        "pasp.hSpacing",
        readUint32FromMp4BoxBytes(outPasp, 8),
        readUint32FromMp4BoxBytes(refPasp, 8)
    );

    assertEqual(
        "pasp.vSpacing",
        readUint32FromMp4BoxBytes(outPasp, 12),
        readUint32FromMp4BoxBytes(refPasp, 12)
    );

    // ---- btrt ----
    assertEqual(
        "btrt.bufferSize",
        readUint32FromMp4BoxBytes(outBtrt, 8),
        readUint32FromMp4BoxBytes(refBtrt, 8)
    );

    assertEqual(
        "btrt.maxBitrate",
        readUint32FromMp4BoxBytes(outBtrt, 12),
        readUint32FromMp4BoxBytes(refBtrt, 12)
    );

    assertEqual(
        "btrt.avgBitrate",
        readUint32FromMp4BoxBytes(outBtrt, 16),
        readUint32FromMp4BoxBytes(refBtrt, 16)
    );

    console.log("PASS: stsd semantic equivalence verified");
}

export async function testStsd_StructuralConformance() {
    console.log("=== testStsd_StructuralConformance (golden MP4) ===");

    const { refStsd, outStsd } =
        await buildReferenceAndOutputStsd();

    assertEqual(
        "stsd.size",
        outStsd.length,
        refStsd.length
    );


    const refStsdFields = dissectStsd(refStsd);
    const outStsdFields = dissectStsd(outStsd);

    console.log("---- STSD FIELD BREAKDOWN (REFERENCE) ----");
    for (const f of refStsdFields) {
        console.log(f);
    }

    console.log("---- STSD FIELD BREAKDOWN (OUTPUT) ----");
    for (const f of outStsdFields) {
        console.log(f);
    }


    const refAvc1 = extractSampleEntry(refStsd, "avc1");
    const outAvc1 = extractSampleEntry(outStsd, "avc1");

    const refAvc1Fields = dissectAvc1(refAvc1);
    const outAvc1Fields = dissectAvc1(outAvc1);

    console.log("---- AVC1 FIELD DIFF ----");
    console.log("REF:", refAvc1Fields);
    console.log("OUT:", outAvc1Fields);
    console.log("--------------------------");

    for (let i = 0; i < refStsd.length; i++) {
        assertEqual(
            `stsd.byte[${i}]`,
            outStsd[i],
            refStsd[i]
        );
    }

    console.log("PASS: stsd matches golden MP4 byte-for-byte");
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

// Extracts the legacy VisualSampleEntry compressorname field.
// This logic is intentionally duplicated across avc1 and stsd tests
// to make semantic equivalence explicit and easy to reason about.
function readCompressorName(box) {
    const len = box[50];
    if (len === 0) return "";
    return new TextDecoder().decode(box.slice(51, 51 + len));
}

function dissectAvc1(box) {
    return {
        width:  readUint16FromMp4BoxBytes(box, 32),
        height: readUint16FromMp4BoxBytes(box, 34),

        horizRes: readUint32FromMp4BoxBytes(box, 36),
        vertRes:  readUint32FromMp4BoxBytes(box, 40),

        frameCount: readUint16FromMp4BoxBytes(box, 48),

        compressorNameLength: box[50],
        compressorNameRaw: box.slice(51, 82),

        depth: readUint16FromMp4BoxBytes(box, 82),
        sentinel: readUint16FromMp4BoxBytes(box, 84)
    };
}

function dissectStsd(box) {
    const fields = [];

    let offset = 0;

    // size
    fields.push({
        name: "size",
        offset,
        value: readUint32FromMp4BoxBytes(box, offset)
    });
    offset += 4;

    // type
    fields.push({
        name: "type",
        offset,
        value: readBoxTypeFromMp4BoxBytes(box, offset)
    });
    offset += 4;

    // version
    fields.push({
        name: "version",
        offset,
        value: box[offset]
    });
    offset += 1;

    // flags (3 bytes)
    fields.push({
        name: "flags",
        offset,
        value: (box[offset] << 16) | (box[offset + 1] << 8) | box[offset + 2]
    });
    offset += 3;

    // entry_count
    fields.push({
        name: "entry_count",
        offset,
        value: readUint32FromMp4BoxBytes(box, offset)
    });
    offset += 4;

    // everything after this is opaque sample entry bytes
    fields.push({
        name: "sample_entry_bytes",
        offset,
        length: box.length - offset
    });

    return fields;
}
