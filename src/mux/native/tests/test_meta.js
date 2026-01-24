import { readUint32, } from "../bytes/mp4ByteReader.js";
import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * =========================================================
 * META — Structural Correctness (Phase A)
 * =========================================================
 *
 * STRUCTURE ONLY.
 * No serialization.
 */
export function testMeta_Structure() {

    const node =
        EmitterRegistry.assemble(
            "moov/udta/meta",
            {
                hdlr: {
                    nameBytes: new Uint8Array([0])
                },
                ilst: {
                    items: []
                }
            }
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("meta.type", node.type, "meta");
    assertEqual("meta.version", node.version, 0);
    assertEqual("meta.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Children (order + presence)
    // ---------------------------------------------------------
    assertExists("meta.children", node.children);
    assertEqual("meta.children.length", node.children.length, 2);

    assertEqual("meta.child[0].type", node.children[0].type, "hdlr");
    assertEqual("meta.child[1].type", node.children[1].type, "ilst");
}


/**
 * =========================================================
 * META — Locked Layout Equivalence (ffmpeg)
 * =========================================================
 *
 * RULES:
 * - BYTES are the authority
 * - NO derived assertions before byte equality
 */
export async function testMeta_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve semantic meta box via truth extractor
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta/meta"
        );

    assertExists("reference meta truth", truth);

    const read   = truth.readBoxReport();
    const params = truth.getEmitterInput();
    const refRaw = read.raw;

    // ---------------------------------------------------------
    // Rebuild via registry
    // ---------------------------------------------------------
    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/udta/meta",
                params
            )
        );

    // ---------------------------------------------------------
    // BYTE AUTHORITY
    // ---------------------------------------------------------
    assertEqual("meta.size", out.length, refRaw.length);

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `meta.byte[${i}]`,
            out[i],
            refRaw[i]
        );
    }
}
