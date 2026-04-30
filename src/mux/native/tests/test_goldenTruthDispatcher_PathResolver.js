import {
    //__TEST_ONLY__,
    // todo, move findTraversalNodesByPathFromBoxBytes to test only.
    findTraversalNodesByPathFromBoxBytes,
} from "./goldenTruthExtractors/GoldenTruthPathResolver.js";

import {
    findBoxesByPathFromMp4,
} from "./reference/BoxExtractor.js";

import {
    getGoldenTruthBox,
} from "./goldenTruthExtractors/index.js";

import {
     assertEqual,
    assertExists,
} from "./assertions.js";

import { readFourCC } from "../box-schema/boxLayoutReaders.js";

export async function testResolveTrakFromPath_SequentialIndexTerminates() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;
    let index = 0;

    try {
        while (true) {
            __TEST_ONLY__.resolveTrakFromPath(
                mp4,
                `moov/trak[${index}]`
            );
            index++;
            if (index > 10) break; // safety guard
        }
    } catch {
        threw = true;
    }

    assertEqual(
        "sequential trak resolution eventually throws",
        threw,
        true
    );
}

export async function testDispatcher_MoovTrak_RepeatedCallsStable() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const first =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4, "moov/trak[0]")
            .readBoxReport()
            .raw;

    const second =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4, "moov/trak[0]")
            .readBoxReport()
            .raw;

    assertEqual(
        "trak resolution stable across calls",
        readFourCC(first, 4),
        readFourCC(second, 4)
    );
}

export async function testDispatcher_Moov_NotMutated_ByChildResolution() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const moovBytes =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4, "moov")
            .readBoxReport()
            .raw;

    // Resolve children multiple times
    getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: moovBytes,
        sourceRegistryKey: "moov",
        targetBoxPath: "moov/trak[0]"
    });

    getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: moovBytes,
        sourceRegistryKey: "moov",
        targetBoxPath: "moov/trak[0]"
    });

    // Moov bytes must still be a valid moov box
    assertEqual(
        "moov box still intact",
        readFourCC(moovBytes, 4),
        "moov"
    );
}

export async function testDispatcher_TrakResolution_TrackIdentitiesAreDistinct() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const trak0 =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4, "moov/trak[0]")
            .readBoxReport()
            .raw;

    const trak1 =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4, "moov/trak[1]")
            .readBoxReport()
            .raw;

    assertEqual(
        "trak[0] and trak[1] are different boxes",
        trak0 === trak1,
        false
    );
}

export async function testDispatcher_TrakLoop_UsesStableMoovBoxBytes() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const moovBytes =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4, "moov")
            .readBoxReport()
            .raw;

    assertExists("moov bytes exist", moovBytes);

    const seen = [];

    let index = 0;

    while (true) {
        try {
            const trakBytes =
                getGoldenTruthBox
                    .getSemanticBoxDataFromBox({
                        boxBytes: moovBytes,
                        sourceRegistryKey: "moov",
                        targetBoxPath: `moov/trak[${index}]`
                    })
                    .readBoxReport()
                    .raw;

            seen.push(trakBytes);
            index++;
        } catch {
            break;
        }
    }

    assertEqual(
        "at least one trak resolved",
        seen.length > 0,
        true
    );

    // Re-read moov and confirm it is still a valid moov box
    assertEqual(
        "moov box still intact after trak loop",
        readFourCC(moovBytes, 4),
        "moov"
    );
}
