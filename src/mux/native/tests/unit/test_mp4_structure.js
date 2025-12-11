// src/mux/native/tests/unit/test_mp4_structure.js

import { BoxFactory } from "../../../native/BoxFactory.js";

// Minimal boxes required to build a moov that lets us validate structure
function buildMinimalMoov() {
    const mvhd = BoxFactory.mvhd({ timescale: 90000, duration: 3000 });
    const tkhd = BoxFactory.tkhd({ width: 64, height: 64, duration: 3000 });

    const mdhd = BoxFactory.mdhd({ timescale: 90000, duration: 3000 });
    const hdlr = BoxFactory.hdlr();
    const vmhd = BoxFactory.vmhd();
    const dref = BoxFactory.dref();

    // stsd needs avcC, stub with minimal 4 bytes
    const stsd = BoxFactory.stsd({
        width: 64,
        height: 64,
        codec: "avc1.42E01E",
        avcC: new Uint8Array([1, 2, 3, 4])
    });

    const stts = BoxFactory.stts(1, 3000);
    const stsc = BoxFactory.stsc();
    const stsz = BoxFactory.stsz([100]);
    const stco = BoxFactory.stco([1000]);

    return BoxFactory.moov({
        mvhd,
        tkhd,
        mdhd,
        hdlr,
        vmhd,
        dref,
        stsd,
        stts,
        stsc,
        stsz,
        stco
    });
}

function parseBoxes(bytes, start = 0, end = bytes.length) {
    const boxes = [];
    let p = start;

    while (p + 8 <= end) {
        const size =
            (bytes[p] << 24) |
            (bytes[p + 1] << 16) |
            (bytes[p + 2] << 8) |
            bytes[p + 3];

        const type = String.fromCharCode(
            bytes[p + 4],
            bytes[p + 5],
            bytes[p + 6],
            bytes[p + 7]
        );

        if (size < 8) {
            throw new Error("Invalid MP4 box size < 8");
        }

        const boxEnd = p + size;

        const children =
            type === "moov" ||
            type === "trak" ||
            type === "mdia" ||
            type === "minf" ||
            type === "stbl" ||
            type === "dref"
            ? parseBoxes(bytes, p + 8, boxEnd)
            : [];

        boxes.push({ type, size, children });

        p = boxEnd;
    }

    return boxes;
}


function findChild(box, type) {
    return box.children.find(b => b.type === type);
}

function assertChild(parent, type) {
    if (!findChild(parent, type)) {
        throw new Error(`FAIL: expected ${parent.type} to contain ${type}`);
    }
}

export function test_mp4_structure() {
    console.log("=== test_mp4_structure ===");

    const moovBytes = buildMinimalMoov();
    const tree = parseBoxes(moovBytes);

    const moov = tree.find(b => b.type === "moov");
    if (!moov) throw new Error("FAIL: moov box missing");

    // Top-level structure
    assertChild(moov, "mvhd");
    const trak = findChild(moov, "trak");
    if (!trak) throw new Error("FAIL: trak missing");

    // Inside trak
    assertChild(trak, "tkhd");
    const mdia = findChild(trak, "mdia");
    if (!mdia) throw new Error("FAIL: mdia missing");

    // Inside mdia
    assertChild(mdia, "mdhd");
    assertChild(mdia, "hdlr");
    const minf = findChild(mdia, "minf");
    if (!minf) throw new Error("FAIL: minf missing");

    // Inside minf
    assertChild(minf, "vmhd");

    const dinf = findChild(minf, "dinf");
    if (!dinf) throw new Error("FAIL: dinf missing inside minf");
    assertChild(dinf, "dref");

    const stbl = findChild(minf, "stbl");
    if (!stbl) throw new Error("FAIL: stbl missing");

    // Inside stbl
    assertChild(stbl, "stsd");
    assertChild(stbl, "stts");
    assertChild(stbl, "stsc");
    assertChild(stbl, "stsz");
    assertChild(stbl, "stco");

    console.log("PASS: MP4 structure is valid");
}
