import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    extractBoxByPathFromMp4,
    extractChildBoxFromContainer,
} from "./reference/BoxExtractor.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";
import { asIsoBoxContainer } from "../box-model/Box.js";

import { readUint32, readInt32 } from "../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * EDTS — Structural Correctness (Phase A)
 * --------------------------------------
 *
 * Validates the structural intent of the Edit Box.
 *
 * This test asserts:
 * - EDTS is a container
 * - required children are present
 * - canonical child ordering
 *
 * No serialization.
 * No byte comparison.
 */
export async function testEdts_Structure() {

    // ---------------------------------------------------------
    // 1. Minimal semantic intent
    // ---------------------------------------------------------
    const intent = {
        elst: {
            version: 0,
            flags: 0,
            entries: [
                {
                    editDuration: 1000,
                    mediaTime: 0,
                    mediaRateInteger: 1,
                    mediaRateFraction: 0
                }
            ]
        }
    };

    // ---------------------------------------------------------
    // 2. Assemble EDTS via registry
    // ---------------------------------------------------------
    const node =
        EmitterRegistry.assemble(
            "moov/trak/edts",
            intent
        );

    // ---------------------------------------------------------
    // 3. Structural assertions
    // ---------------------------------------------------------
    assertExists("edts node", node);
    assertExists("edts.children", node.children);

    const childTypes = node.children.map(c => c.type);

    assertEqual(
        "edts.childCount",
        childTypes.length,
        1
    );

    assertEqual(
        "edts.childOrder",
        childTypes.join(","),
        "elst"
    );
}

export async function testEdts_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Reference EDTS
    // ---------------------------------------------------------
    const refEdts =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/edts"
            )
            .readBoxReport()
            .raw;

    assertExists("reference edts", refEdts);

    // ---------------------------------------------------------
    // Rebuild via registry
    // ---------------------------------------------------------
    const params =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/edts"
            )
            .getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak/edts",
                params
            )
        );

    // ---------------------------------------------------------
    // Container comparison (ISO only)
    // ---------------------------------------------------------
    const refContainer =
        asIsoBoxContainer(
            refEdts,
            "moov/trak/edts"
        );

    const outContainer =
        asIsoBoxContainer(
            out,
            "moov/trak/edts"
        );

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual(
        "edts.childCount",
        outChildren.length,
        refChildren.length
    );

    // ---------------------------------------------------------
    // Child-by-child equivalence
    // ---------------------------------------------------------
    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refChildren[i];
        const outChild = outChildren[i];

        assertEqual(
            `edts.child[${i}].type`,
            outChild.type,
            refChild.type
        );

        const refBytes =
            refEdts.slice(
                refChild.offset,
                refChild.offset + refChild.size
            );

        const outBytes =
            out.slice(
                outChild.offset,
                outChild.offset + outChild.size
            );

        for (let j = 0; j < refBytes.length; j++) {
            assertEqualHex(
                `edts.${refChild.type}.byte[${j}]`,
                outBytes[j],
                refBytes[j]
            );
        }

        assertEqual(
            `edts.${refChild.type}.size`,
            outBytes.length,
            refBytes.length
        );
    }

    // ---------------------------------------------------------
    // Full box safety net
    // ---------------------------------------------------------
    for (let i = 0; i < refEdts.length; i++) {
        assertEqualHex(
            `edts.byte[${i}]`,
            out[i],
            refEdts[i]
        );
    }
}

export async function testEdts_LockedLayoutEquivalence_ffmpeg_Audio() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const refEdts =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[1]/edts"
            )
            .readBoxReport()
            .raw;

    assertExists("reference edts", refEdts);

    const params =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[1]/edts"
            )
            .getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak/edts",
                params
            )
        );

    const refContainer =
        asIsoBoxContainer(
            refEdts,
            "moov/trak/edts"
        );

    const outContainer =
        asIsoBoxContainer(
            out,
            "moov/trak/edts"
        );

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual(
        "edts.childCount",
        outChildren.length,
        refChildren.length
    );

    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refChildren[i];
        const outChild = outChildren[i];

        assertEqual(
            `edts.child[${i}].type`,
            outChild.type,
            refChild.type
        );

        const refBytes =
            refEdts.slice(
                refChild.offset,
                refChild.offset + refChild.size
            );

        const outBytes =
            out.slice(
                outChild.offset,
                outChild.offset + outChild.size
            );

        for (let j = 0; j < refBytes.length; j++) {
            assertEqualHex(
                `edts.${refChild.type}.byte[${j}]`,
                outBytes[j],
                refBytes[j]
            );
        }

        assertEqual(
            `edts.${refChild.type}.size`,
            outBytes.length,
            refBytes.length
        );
    }

    for (let i = 0; i < refEdts.length; i++) {
        assertEqualHex(
            `edts.byte[${i}]`,
            out[i],
            refEdts[i]
        );
    }
}

