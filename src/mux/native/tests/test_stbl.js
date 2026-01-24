import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import { asIsoBoxContainer } from "../box-model/Box.js";

import {
    extractChildBoxFromContainer,
} from "./reference/BoxExtractor.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export function testStbl_Structure() {
    return;

    const fakeSampleEntry = {
        type: "avc1",
        body: [],
        children: []
    };

    // ---------------------------------------------------------
    // 1. Minimal required child nodes
    // ---------------------------------------------------------
    const stsd =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd",
            {
                sampleEntries: [
                    { type: "avc1", body: [], children: [] }
                ]
            }
        );

    const stts =
        EmitterRegistry.emit(
        { entries: [] }
    );
    const stsc = EmitterRegistry.emit(
        { entries: [] }
    );
    const stsz = EmitterRegistry.emit(
        { sizes: [] }
    );
    const stco = EmitterRegistry.emit(
        { chunkOffsets: [] }
    );

    // Optional
    const stss = { type: "stss", body: [] };
    const ctts = { type: "ctts", body: [] };

    // ---------------------------------------------------------
    // 2. Assemble STBL (node graph only)
    // ---------------------------------------------------------
    const node = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl",
        {
            stsdNode: stsd,
            sttsNode: stts,
            stscNode: stsc,
            stszNode: stsz,
            stcoNode: stco,
            stssNode: stss,
            cttsNode: ctts
        }
    );

    // ---------------------------------------------------------
    // 3. Node-level assertions
    // ---------------------------------------------------------
    if (node.type !== "stbl") {
        throw new Error(
            `Expected node.type === "stbl", got "${node.type}"`
        );
    }

    if (!Array.isArray(node.children)) {
        throw new Error("stbl.children must be an array");
    }

    const types = node.children.map(c => c.type);

    // ---------------------------------------------------------
    // 4. Required children
    // ---------------------------------------------------------
    for (const required of ["stsd", "stts", "stsc", "stsz", "stco"]) {
        if (!types.includes(required)) {
            throw new Error(
                `STBL missing required child '${required}'`
            );
        }
    }

    // ---------------------------------------------------------
    // 5. Optional children
    // ---------------------------------------------------------
    if (!types.includes("stss")) {
        throw new Error("STBL missing optional child 'stss'");
    }

    if (!types.includes("ctts")) {
        throw new Error("STBL missing optional child 'ctts'");
    }

}

export async function testStbl_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4 (video-only)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract golden truth (authoritative)
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl"
        );

    const refReport = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const refRaw = refReport.raw;

    assertExists("reference STBL (video)", refRaw);

    // ---------------------------------------------------------
    // 3. Rebuild STBL directly from semantic intent
    // ---------------------------------------------------------
    const out = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl",
            params
        )
    );

    // ---------------------------------------------------------
    // 4. Child-level byte-for-byte equivalence
    // ---------------------------------------------------------
    const refContainer =
        asIsoBoxContainer(
            refRaw,
            "moov/trak/mdia/minf/stbl"
        );

    const outContainer =
        asIsoBoxContainer(
            out,
            "moov/trak/mdia/minf/stbl"
        );

    const refChildren = refContainer.enumerateChildren();

    for (const { type, offset, size } of refChildren) {

        const refBytes =
            refRaw.slice(offset, offset + size);

        const outChild =
            outContainer.enumerateChildren()
                .find(c => c.type === type);

        assertExists(`stbl.${type} exists`, outChild);

        const outBytes =
            out.slice(outChild.offset, outChild.offset + outChild.size);

        assertEqual(
            `stbl.${type}.size`,
            outBytes.length,
            refBytes.length
        );

        for (let i = 0; i < refBytes.length; i++) {
            assertEqualHex(
                `stbl.${type}.byte[${i}]`,
                outBytes[i],
                refBytes[i]
            );
        }
    }
}

export async function testStbl_LockedLayoutEquivalence_ffmpeg_Audio() {

    // ---------------------------------------------------------
    // 1. Load golden MP4 (audio track)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract golden truth (authoritative)
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl"
        );

    const refReport = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const refRaw = refReport.raw;

    assertExists("reference STBL (audio)", refRaw);

    // ---------------------------------------------------------
    // 3. Rebuild STBL directly from semantic intent
    // ---------------------------------------------------------
    const out = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl",
            params
        )
    );

    // ---------------------------------------------------------
    // 4. Child-level byte-for-byte equivalence
    // ---------------------------------------------------------
    const refContainer =
        asIsoBoxContainer(
            refRaw,
            "moov/trak/mdia/minf/stbl"
        );

    const outContainer =
        asIsoBoxContainer(
            out,
            "moov/trak/mdia/minf/stbl"
        );

    const refChildren = refContainer.enumerateChildren();

    for (const { type, offset, size } of refChildren) {

        const refBytes =
            refRaw.slice(offset, offset + size);

        const outChild =
            outContainer.enumerateChildren()
                .find(c => c.type === type);

        assertExists(`stbl.${type} exists`, outChild);

        const outBytes =
            out.slice(outChild.offset, outChild.offset + outChild.size);

        assertEqual(
            `stbl.${type}.size`,
            outBytes.length,
            refBytes.length
        );

        for (let i = 0; i < refBytes.length; i++) {
            assertEqualHex(
                `stbl.${type}.byte[${i}]`,
                outBytes[i],
                refBytes[i]
            );
        }
    }
}
