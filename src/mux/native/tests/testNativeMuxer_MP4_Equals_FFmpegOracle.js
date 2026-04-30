import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";
import { buildUdtaIntentFromBuildHints } from "../builders/buildUdtaIntentFromBuildHints.js";
import { composeMoovNode } from "../composers/composeMoovNode.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertBytesWithStubbedStco } from "./assertBytesWithStubbedStco.js";

export async function testNativeMuxer_MP4_Equals_FFmpegOracle() {

    const fixtures = [ "reference/reference_av.mp4", "reference/reference_av_opus.mp4", ];

    const failures = [];

    for (const fixture of fixtures) {

        console.log("\n====================================================");
        console.log("FIXTURE:", fixture);
        console.log("====================================================");

        try {

            // -------------------------------------------------
            // Load oracle
            // -------------------------------------------------
            const resp = await fetch(fixture);
            const oracleBytes = new Uint8Array(await resp.arrayBuffer());

            // -------------------------------------------------
            // Run golden client (semantic inputs)
            // -------------------------------------------------
            const mp4CompilerState =
                await runGoldenMp4AVTestClient({ mp4Bytes: oracleBytes });

            // -------------------------------------------------
            // ACT: full compilation
            // -------------------------------------------------
            let compilerBytes;

            try {
                const result = compileMp4({ mp4CompilerState });
                compilerBytes = result?.bytes;

                if (!(compilerBytes instanceof Uint8Array)) {
                    throw new Error(
                        "compileMp4 did not return { bytes: Uint8Array }"
                    );
                }

            } catch (err) {
                failures.push({
                    fixture,
                    stage: "compileMp4",
                    error: err
                });
                console.error("COMPILATION FAILED:", err);
                continue;
            }

            // -------------------------------------------------
            // Byte-for-byte comparison
            // -------------------------------------------------
            const diffs = [];
            const byteCount =
                Math.max(compilerBytes.length, oracleBytes.length);

            for (let i = 0; i < byteCount; i++) {
                assertEqualHexCollect(
                    diffs,
                    `${fixture}: mp4.byte[${i}]`,
                    compilerBytes[i],
                    oracleBytes[i]
                );
            }

            if (diffs.length) {
                console.table(diffs.slice(0, 50));
                throw new Error(
                    `MP4 mismatch (${diffs.length} bytes differ)`
                );
            }

            console.log(`PASS: ${fixture}`);

        } catch (err) {

            failures.push({
                fixture,
                error: err
            });

            console.error("MP4 comparison failed:", err);
        }
    }

    // ---------------------------------------------------------
    // Final result
    // ---------------------------------------------------------
    if (failures.length) {

        console.error("\n================ MP4 FAILURES ================");

        for (const f of failures) {
            console.error(
                `Fixture ${f.fixture}`,
                f.stage ? `(stage: ${f.stage})` : "",
                f.error?.message ?? f.error
            );
        }

        throw new Error(
            `MP4 mismatch: ${failures.length} failing case(s)`
        );
    }
}
