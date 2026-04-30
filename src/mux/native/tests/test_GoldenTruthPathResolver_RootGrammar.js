import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import {
    assertExists,
    assertEqual
} from "./assertions.js";

export async function test_PathResolver_rejects_relative_paths() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let error;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "trak[0]/mdia/minf/stbl"
        );
    } catch (e) {
        error = e;
    }

    if (!error) {
        throw new Error("Expected error for relative path");
    }

    assertExists("relative path throws", error);
}

export async function test_PathResolver_rejects_mdat_root() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let error;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "mdat");
    } catch (e) {
        error = e;
    }

    if (!error) {
        throw new Error("Expected error when addressing mdat");
    }

    if (!error.message.includes("raw media payload")) {
        throw new Error(
            "Error must explain why mdat cannot be addressed.\n\n" +
            error.message
        );
    }
}

export async function test_PathResolver_accepts_mdat_root() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "mdat"
        );

    if (!truth) {
        throw new Error("Expected mdat to be addressable");
    }

    const read = truth.readBoxReport();

    if (!read || !(read.raw instanceof Uint8Array)) {
        throw new Error("Expected mdat extractor to return raw bytes");
    }

    if (read.box.type !== "mdat") {
        throw new Error(
            `Expected box type 'mdat', got '${read.box.type}'`
        );
    }
}

export async function test_PathResolver_rejects_invalid_root() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let error;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "stbl");
    } catch (e) {
        error = e;
    }

    if (!error) {
        throw new Error("Expected error for invalid root box");
    }

    assertExists("invalid root throws", error);

    assertEqual(
    "error is root grammar error",
    error.message.includes("Traversal paths must be absolute"),
    true
);;
}

export async function test_PathResolver_rejects_unindexed_trak() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let error;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "moov/trak/mdia");
    } catch (e) {
        error = e;
    }

    if (!error) {
        throw new Error("Expected error for unindexed trak");
    }

    if (!error.message.includes("trak[n]")) {
        throw new Error(
            "Error must explain indexed trak grammar.\n\n" +
            error.message
        );
    }
}
