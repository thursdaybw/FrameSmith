import {
    assertExists,
    assertEqual
} from "./assertions.js";

import { asContainer } from "../box-model/Box.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";

import {
    runWebCodecsTestClient
} from "./clients/webcodecsReferenceSourceClient.js";

import {
    createMp4FromInputs
} from "./test_NativeMuxer_EndToEnd_FromMp4BuildInput.js";

/**
 * ============================================================================
 * TEST A4 — WebCodecs semantic end-to-end (creative)
 * ============================================================================
 *
 * Contract:
 * ---------
 * Given:
 *   - semantic-only encoder output from WebCodecs
 *
 * When:
 *   - compiled via createMp4FromInputs
 *
 * Then:
 *   - a structurally valid MP4 is produced
 *   - the file is playable
 *
 * This test asserts STRUCTURE ONLY.
 * There is no oracle.
 */
export async function test_NativeMuxer_EndToEnd_FromWebCodecs_Semantic() {
    console.log("=== test_NativeMuxer_EndToEnd_FromWebCodecs_Semantic ===");

    const mp4BuildInput =
        await runWebCodecsTestClient();

    const outBytes =
        createMp4FromInputs(mp4BuildInput);

    // ---------------------------------------------------------
    // Root container sanity
    // ---------------------------------------------------------
    const root = asContainer(outBytes);
    assertExists("root container", root);

    const topLevel =
        root.enumerateChildren().map(b => b.type);

    assertEqual("top-level[0]", topLevel[0], "ftyp");
    assertEqual("top-level[1]", topLevel[1], "free");
    assertEqual("top-level[2]", topLevel[2], "mdat");
    assertEqual("top-level[3]", topLevel[3], "moov");

    // ---------------------------------------------------------
    // Required structural boxes
    // ---------------------------------------------------------
    assertExists(
        "moov",
        extractBoxByPathFromMp4(outBytes, "moov")
    );

    assertExists(
        "trak",
        extractBoxByPathFromMp4(outBytes, "moov/trak")
    );

    assertExists(
        "mdia",
        extractBoxByPathFromMp4(outBytes, "moov/trak/mdia")
    );

    assertExists(
        "stbl",
        extractBoxByPathFromMp4(
            outBytes,
            "moov/trak/mdia/minf/stbl"
        )
    );

    // ---------------------------------------------------------
    // Sample table sanity
    // ---------------------------------------------------------
    assertExists(
        "stsd",
        extractBoxByPathFromMp4(
            outBytes,
            "moov/trak/mdia/minf/stbl/stsd"
        )
    );

    assertExists(
        "stts",
        extractBoxByPathFromMp4(
            outBytes,
            "moov/trak/mdia/minf/stbl/stts"
        )
    );

    assertExists(
        "stsz",
        extractBoxByPathFromMp4(
            outBytes,
            "moov/trak/mdia/minf/stbl/stsz"
        )
    );

    assertExists(
        "stco",
        extractBoxByPathFromMp4(
            outBytes,
            "moov/trak/mdia/minf/stbl/stco"
        )
    );

    // ---------------------------------------------------------
    // MDAT sanity (must contain payload)
    // ---------------------------------------------------------
    const mdat =
        extractBoxByPathFromMp4(outBytes, "mdat");

    assertEqual(
        "mdat has payload",
        mdat.length > 8,
        true
    );

    // ---------------------------------------------------------
    // Optional: download for human verification
    // ---------------------------------------------------------
    if (window.DEBUG_DOWNLOAD_MP4 === true) {
        downloadMp4(outBytes, "webcodecs-native-muxer.mp4");
    }

    console.log(
        "PASS: WebCodecs semantic MP4 produced and structurally valid"
    );
}

// -------------------------------------------------------------
// Local helper (copied intentionally — test-local concern)
// -------------------------------------------------------------
function downloadMp4(bytes, filename) {
    const blob = new Blob([bytes], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
