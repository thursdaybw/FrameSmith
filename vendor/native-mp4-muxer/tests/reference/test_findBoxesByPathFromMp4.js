import {
    findBoxesByPathFromMp4,
    extractChildBoxFromContainer,
} from "./BoxExtractor.js";

import {
    assertEqual,
    assertExists,
    assertIsBoxType,
} from "../assertions.js";

/**
 * root singular boxes (moov) 
 */
export async function testFindBoxes_Moov_Root() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const moovs = findBoxesByPathFromMp4(mp4, "moov");

    assertEqual("moov.count", moovs.length, 1);
    assertIsBoxType("moov[0]", moovs[0], "moov");

}

/**
 * video-only oracle has exactly one trak
 */
export async function testFindBoxes_Trak_VideoOnly() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const traks = findBoxesByPathFromMp4(mp4, "moov/trak");

    assertEqual("trak.count", traks.length, 1);
    assertIsBoxType("trak[0]", traks[0], "trak");

}

/**
 * AV oracle has two traks
 */
export async function testFindBoxes_Trak_AudioVideo() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const traks = findBoxesByPathFromMp4(mp4, "moov/trak");

    assertEqual("trak.count", traks.length, 2);

    assertIsBoxType("trak[0]", traks[0], "trak");
    assertIsBoxType("trak[1]", traks[1], "trak");

}

/**
 * mdia fans out one-per-trak (structural truth)
 */
export async function testFindBoxes_Mdia_FanOut() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const mdias = findBoxesByPathFromMp4(
        mp4,
        "moov/trak/mdia"
    );

    assertEqual("mdia.count", mdias.length, 2);

    for (let i = 0; i < mdias.length; i++) {
        assertIsBoxType(`mdia[${i}]`, mdias[i], "mdia");
    }

}

/**
 * deeper fan-out (moov/trak/mdia/minf/stbl)
 */
export async function testFindBoxes_Stbl_DeepFanOut() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const stbls =
        findBoxesByPathFromMp4(
            mp4,
            "moov/trak/mdia/minf/stbl"
        );

    assertEqual("stbl.count", stbls.length, 2);

    for (let i = 0; i < stbls.length; i++) {
        assertIsBoxType(`stbl[${i}]`, stbls[i], "stbl");
    }

}

/**
 * sgpd exists only in audio track
 * This is the money test. Structural discrimination without semantic guessing.
 */
export async function testFindBoxes_Sgpd_AudioOnly() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const sgpds = findBoxesByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/sgpd"
    );

    // Structural truth: exactly one sgpd in AV oracle
    assertEqual("sgpd.count", sgpds.length, 1);
    assertIsBoxType("sgpd[0]", sgpds[0], "sgpd");

}


export async function testFindBoxesFromMp4_RejectsNonBoxTraversal() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;
    let message = "";

    try {
        findBoxesByPathFromMp4(
            mp4,
            "moov/trak/mdia/minf/stbl/stsd/avc1"
        );
    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    assertEqual(
        "throws on traversal into non-box child",
        threw,
        true
    );

    assertEqual(
        "error mentions invalid traversal segment",
        message.includes("Invalid traversal") ||
        message.includes("not a child box"),
        true
    );
}

export async function testFindBoxesFromMp4_AllowsTerminalStsd() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const stsd =
        findBoxesByPathFromMp4(
            mp4,
            "moov/trak/mdia/minf/stbl/stsd"
        );

    assertEqual("stsd.count", stsd.length, 2);

    for (let i = 0; i < stsd.length; i++) {
        assertIsBoxType(`stsd[${i}]`, stsd[i], "stsd");
    }

}


export async function testFindBoxesFromMp4_RejectsDeepTraversalPastStsd() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        findBoxesByPathFromMp4(
            mp4,
            "moov/trak/mdia/minf/stbl/stsd/avc1/btrt"
        );
    } catch {
        threw = true;
    }

    assertEqual(
        "deep traversal past stsd throws",
        threw,
        true
    );

}

export async function testFindBoxesFromMp4_EmptyBeforeStsdIsStillValid() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const boxes =
        findBoxesByPathFromMp4(
            mp4,
            "moov/trak/mdia/minf/doesNotExist"
        );

    assertEqual(
        "empty result allowed",
        boxes.length,
        0
    );

}
