import {
    assertExists,
    assertEqual
} from "./assertions.js";

import { asIsoBoxContainer } from "../box-model/Box.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";

import {
    runWebCodecsAudioVideoTestClient
} from "./clients/webcodecsReferenceAudioVideoSourceClient.js";

import {
    createMp4FromInputs
} from "../compiler/createMp4FromInputs.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

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

    const t0 = performance.now();

    // ---------------------------------------------------------
    // Phase 1 — WebCodecs encode + adaptation
    // ---------------------------------------------------------
    console.log("[PHASE 1] Starting WebCodecs test client…");

    const tEncodeStart = performance.now();

    const result = await runWebCodecsAudioVideoTestClient();

    const mp4BuildInput = {
        tracks: result.tracks
    };

    const tEncodeEnd = performance.now();

    console.log("[PHASE 1] WebCodecs client complete", {
        tracks: mp4BuildInput.tracks.length,
        encodeMs: Math.round(tEncodeEnd - tEncodeStart)
    });

    // Give the browser a breath before heavy sync work
    await Promise.resolve();

    // ---------------------------------------------------------
    // Phase 2 — MP4 compilation
    // ---------------------------------------------------------
    console.log("[PHASE 2] Starting MP4 compilation…");

    const tCompileStart = performance.now();
    const outBytes = createMp4FromInputs(mp4BuildInput);

    const tCompileEnd = performance.now();

    console.log("[PHASE 2] MP4 compilation complete", {
        bytes: outBytes.length,
        compileMs: Math.round(tCompileEnd - tCompileStart)
    });

    // ---------------------------------------------------------
    // Phase 3 — Structural validation
    // ---------------------------------------------------------
    console.log("[PHASE 3] Validating MP4 structure…");

    const moov =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(outBytes, "moov");

    assertExists("moov", moov);

    // Top-level presence
    const ftyp =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(outBytes, "ftyp");

    const mdat =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(outBytes, "mdat");

    assertExists("ftyp present", ftyp);
    assertExists("mdat present", mdat);

    // Track structure (explicitly indexed)
    assertExists(
        "trak",
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            outBytes,
            "moov/trak[0]"
        )
    );

    assertExists(
        "mdia",
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            outBytes,
            "moov/trak[0]/mdia"
        )
    );

    assertExists(
        "stbl",
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            outBytes,
            "moov/trak[0]/mdia/minf/stbl"
        )
    );

    assertExists(
        "stsd",
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            outBytes,
            "moov/trak[0]/mdia/minf/stbl/stsd"
        )
    );

    assertExists(
        "stts",
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            outBytes,
            "moov/trak[0]/mdia/minf/stbl/stts"
        )
    );

    assertExists(
        "stsz",
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            outBytes,
            "moov/trak[0]/mdia/minf/stbl/stsz"
        )
    );

    assertExists(
        "stco",
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            outBytes,
            "moov/trak[0]/mdia/minf/stbl/stco"
        )
    );

    // mdat payload sanity (structure-only check)
    const mdatReport = mdat.readBoxReport();

    assertEqual(
        "mdat has payload",
        mdatReport.raw.length > 8,
        true
    );


    // ---------------------------------------------------------
    // Opus inspection
    // ---------------------------------------------------------


    //await opusInspection(outBytes);
    // ---------------------------------------------------------
    // Phase 4 — Optional download
    // ---------------------------------------------------------
    if (window.DEBUG_DOWNLOAD_MP4 === true) {
        console.log("[PHASE 4] Downloading MP4 for inspection…");
        downloadMp4(outBytes, "webcodecs-native-muxer.mp4");
    }

    const tEnd = performance.now();

    console.log("PASS: WebCodecs semantic MP4 produced and structurally valid", {
        totalMs: Math.round(tEnd - t0)
    });
}

async function opusInspection(outBytes) {

    const oracleResp  = await fetch("reference/reference_av_opus.mp4");
    const oracleBytes = new Uint8Array(await oracleResp.arrayBuffer());

    // ---------------------------------------------------------
    // Opus SampleEntry
    // ---------------------------------------------------------

    const oracleOpus =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            oracleBytes,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]"
        );

    const producedOpus =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            outBytes,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]"
        );

    const oracleOpusReport   = oracleOpus.readBoxReport();
    const producedOpusReport = producedOpus.readBoxReport();

    console.log("[ORACLE][Opus] size =", oracleOpusReport.raw.length);
    console.log("[PRODUCED][Opus] size =", producedOpusReport.raw.length);

    console.log(
        "[ORACLE][Opus][hex]",
        Array.from(oracleOpusReport.raw)
            .map(b => b.toString(16).padStart(2, "0"))
            .join(" ")
    );

    console.log(
        "[PRODUCED][Opus][hex]",
        Array.from(producedOpusReport.raw)
            .map(b => b.toString(16).padStart(2, "0"))
            .join(" ")
    );

    // ---------------------------------------------------------
    // dOps (direct child of Opus SampleEntry)
    // ---------------------------------------------------------

    const oracleDOps =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            oracleBytes,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/dOps"
        );

    const producedDOps =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            outBytes,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/dOps"
        );

    const o = oracleDOps.readBoxReport();
    const p = producedDOps.readBoxReport();

    console.log("[ORACLE][dOps] header+payload bytes:", o.raw.length);
    console.log("[PRODUCED][dOps] header+payload bytes:", p.raw.length);

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
