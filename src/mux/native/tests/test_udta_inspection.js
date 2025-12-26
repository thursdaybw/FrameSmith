import {
    extractBoxByPathFromMp4,
    findFourCC
} from "./reference/BoxExtractor.js";

import { asContainer } from "../box-model/Box.js";
import {
    readUint32,
    readFourCC
} from "../bytes/mp4ByteReader.js";

/*
 * =========================================================
 * UDTA — Inspection (ffmpeg)
 * =========================================================
 *
 * Scope:
 *   moov > udta
 *
 * Responsibility:
 *   - presence
 *   - size
 *   - direct children
 *
 * No semantics. No rebuilding. No assertions.
 */
export async function testUdta_Inspection_ffmpeg() {
    console.log("=== testUdta_Inspection_ffmpeg ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4 = new Uint8Array(await resp.arrayBuffer());

    const udta = extractBoxByPathFromMp4(mp4, "moov/udta");
    if (!udta) {
        console.log("No udta box present");
        return;
    }

    console.log("udta size:", readUint32(udta, 0));

    const udtaContainer = asContainer(udta);
    const children = udtaContainer.enumerateChildren();

    console.log("udta child boxes:");
    for (const c of children) {
        console.log(`  - ${c.type} (${c.size} bytes)`);
    }

    console.log("PASS: udta inspection completed");
}

export async function testMeta_Inspection_ffmpeg() {
    console.log("=== testMeta_Inspection_ffmpeg ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4 = new Uint8Array(await resp.arrayBuffer());

    const meta = extractBoxByPathFromMp4(mp4, "moov/udta/meta");
    if (!meta) {
        console.log("meta not found");
        return;
    }

    console.log("meta version:", meta[8]);
    console.log("meta flags:",
        (meta[9] << 16) | (meta[10] << 8) | meta[11]
    );

    const metaContainer = asContainer(meta);
    const children = metaContainer.enumerateChildren();

    console.log("meta child boxes:");
    for (const c of children) {
        console.log(`  - ${c.type} (${c.size} bytes)`);
    }

    console.log("PASS: meta inspection completed");
}

export async function testMetaHdlr_Inspection_ffmpeg() {
    console.log("=== testMetaHdlr_Inspection_ffmpeg ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4 = new Uint8Array(await resp.arrayBuffer());

    const hdlr = extractBoxByPathFromMp4(
        mp4,
        "moov/udta/meta/hdlr"
    );

    if (!hdlr) {
        console.log("hdlr not found");
        return;
    }

    console.log("hdlr.size:", readUint32(hdlr, 0));
    console.log("hdlr.type:", readFourCC(hdlr, 4));
    console.log("hdlr.version:", hdlr[8]);
    console.log("hdlr.flags:",
        (hdlr[9] << 16) | (hdlr[10] << 8) | hdlr[11]
    );

    console.log("hdlr.handler_type:",
        String.fromCharCode(hdlr[16], hdlr[17], hdlr[18], hdlr[19])
    );

    console.log("meta > hdlr raw bytes (offset : hex : ascii)");

    for (let i = 0; i < hdlr.length; i++) {
        const hex = hdlr[i].toString(16).padStart(2, "0");
        const ascii =
            hdlr[i] >= 0x20 && hdlr[i] <= 0x7e
            ? String.fromCharCode(hdlr[i])
            : ".";
        console.log(
            i.toString().padStart(2, "0"),
            ":",
            hex,
            ":",
            ascii
        );
    }

    console.log("PASS: meta > hdlr inspection completed");
}

export async function testMetaIlst_Inspection_ffmpeg() {
    console.log("=== testMetaIlst_Inspection_ffmpeg ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4 = new Uint8Array(await resp.arrayBuffer());

    const ilst = extractBoxByPathFromMp4(
        mp4,
        "moov/udta/meta/ilst"
    );

    if (!ilst) {
        console.log("ilst not found");
        return;
    }

    console.log("ilst.size:", readUint32(ilst, 0));
    console.log("ilst.type:", readFourCC(ilst, 4));

    const payload = ilst.slice(8);

    console.log(
        "ilst payload hex:",
        Array.from(payload)
        .map(b => b.toString(16).padStart(2, "0"))
        .join(" ")
    );

    console.log(
        "ilst payload ascii:",
        Array.from(payload)
        .map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : ".")
        .join("")
    );

    console.log("PASS: meta > ilst inspection completed");
}
