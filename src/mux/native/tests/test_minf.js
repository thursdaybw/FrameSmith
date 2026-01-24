import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import { asIsoBoxContainer } from "../box-model/Box.js";

import {
    extractChildBoxFromContainer
} from "./reference/BoxExtractor.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export async function testMinf_BuilderInput_Video() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf"
        );

    const input = truth.getEmitterInput();

    assertExists("builder input", input);
    assertExists("mediaHeader", input.mediaHeader);
    assertExists("dinf", input.dinf);
    assertExists("stbl", input.stbl);

    assertEqual(
        "video mediaHeader is vmhd",
        input.mediaHeader.type,
        "vmhd"
    );

}

export async function testMinf_BuilderInput_Audio() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf"
        );

    const input = truth.getEmitterInput();

    assertExists("builder input", input);
    assertExists("mediaHeader", input.mediaHeader);
    assertExists("dinf", input.dinf);
    assertExists("stbl", input.stbl);

    assertEqual(
        "audio mediaHeader is smhd",
        input.mediaHeader.type,
        "smhd"
    );

}

export async function testMinf_LockedLayoutEquivalence_ffmpeg_Video() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const refMinf =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf"
            )
            .readBoxReport()
            .raw;

    assertExists("reference minf", refMinf);

    const params =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf"
            )
            .getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak/mdia/minf",
                params
            )
        );

    const refContainer =
        asIsoBoxContainer(
            refMinf,
            "moov/trak/mdia/minf"
        );

    const outContainer =
        asIsoBoxContainer(
            out,
            "moov/trak/mdia/minf"
        );

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual(
        "minf.childCount",
        outChildren.length,
        refChildren.length
    );

    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refChildren[i];
        const outChild = outChildren[i];

        assertEqual(
            `minf.child[${i}].type`,
            outChild.type,
            refChild.type
        );

        const refBytes =
            refMinf.slice(
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
                `minf.${refChild.type}.byte[${j}]`,
                outBytes[j],
                refBytes[j]
            );
        }

        assertEqual(
            `minf.${refChild.type}.size`,
            outBytes.length,
            refBytes.length
        );
    }
}


export async function testMinf_LockedLayoutEquivalence_ffmpeg_Audio() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const refMinf =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[1]/mdia/minf"
            )
            .readBoxReport()
            .raw;

    assertExists("reference minf (audio)", refMinf);

    const params =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[1]/mdia/minf"
            )
            .getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak/mdia/minf",
                params
            )
        );

    const refContainer =
        asIsoBoxContainer(
            refMinf,
            "moov/trak/mdia/minf"
        );

    const outContainer =
        asIsoBoxContainer(
            out,
            "moov/trak/mdia/minf"
        );

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual(
        "minf.childCount",
        outChildren.length,
        refChildren.length
    );

    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refChildren[i];
        const outChild = outChildren[i];

        assertEqual(
            `minf.child[${i}].type`,
            outChild.type,
            refChild.type
        );

        const refBytes =
            refMinf.slice(
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
                `minf.${refChild.type}.byte[${j}]`,
                outBytes[j],
                refBytes[j]
            );
        }

        assertEqual(
            `minf.${refChild.type}.size`,
            outBytes.length,
            refBytes.length
        );
    }
}
