import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { asContainer } from "../box-model/Box.js";

import {
    readUint32,
    readFourCC
} from "../bytes/mp4ByteReader.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";

import { emitMetaHdlrBox } from "../box-emitters/metaHdlrBox.js";
import { emitIlstBox } from "../box-emitters/ilstBox.js";
import { emitMetaBox } from "../box-emitters/metaBox.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * =========================================================
 * META — Structural Correctness (Phase A)
 * =========================================================
 */
export function testMeta_Structure() {

    console.log("=== testMeta_Structure ===");

    const node = emitMetaBox({
        hdlr: emitMetaHdlrBox({ nameBytes: new Uint8Array([0]) }),
        ilst: emitIlstBox({ items: [] })
    });

    const bytes = serializeBoxTree(node);

    assertEqual("meta.type", readFourCC(bytes, 4), "meta");
    assertEqual("meta.version", bytes[8], 0);
    assertEqual(
        "meta.flags",
        (bytes[9] << 16) | (bytes[10] << 8) | bytes[11],
        0
    );

    const container = asContainer(bytes);
    const children = container.enumerateChildren();

    assertEqual("meta.child.count", children.length, 2);
    assertEqual("meta.child[0].type", children[0].type, "hdlr");
    assertEqual("meta.child[1].type", children[1].type, "ilst");

    console.log("PASS: META structural correctness");
}


/**
 * =========================================================
 * META — Locked Layout Equivalence (ffmpeg)
 * =========================================================
 *
 * RULES:
 * - NO size assertions until the end
 * - NO derived fields before bytes
 * - BYTES are the authority
 */
export async function testMeta_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testMeta_LockedLayoutEquivalence_ffmpeg ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const refMeta = extractBoxByPathFromMp4(
        mp4,
        "moov/udta/meta"
    );
    assertExists("reference meta", refMeta);

    // ---------------------------------------------------------
    // Golden truth → exact emitter input
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromBox(
        refMeta,
        "moov/udta/meta"
    );

    const params = truth.getBuilderInput();

    // ---------------------------------------------------------
    // Rebuild exclusively from golden truth
    // ---------------------------------------------------------
    const out = serializeBoxTree(
        emitMetaBox(params)
    );

    // ---------------------------------------------------------
    // BYTE AUTHORITY
    // ---------------------------------------------------------
    assertEqual("meta.size", out.length, refMeta.length);

    for (let i = 0; i < refMeta.length; i++) {
        assertEqualHex(
            `meta.byte[${i}]`,
            out[i],
            refMeta[i]
        );
    }

    console.log("PASS: META locked-layout equivalence with ffmpeg");
}
