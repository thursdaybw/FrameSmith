import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";
import {
    assertEqualHexCollect,
} from "./assertions.js";


export async function testNativeMuxer_ELST_Equals_FFmpegOracle() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4",
    ];

    const failures = [];

    for (const fixture of fixtures) {

        console.log("\n====================================================");
        console.log("FIXTURE:", fixture);
        console.log("====================================================");

        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        const mp4CompilerState =
            await runGoldenMp4AVTestClient({ mp4Bytes });

        prepareTracksForStructuralDerivation({ mp4CompilerState });

        mp4CompilerState.storedIntent.mvhd =
            buildMvhdIntentFromCompilerState({ mp4CompilerState });

        for (let trackIndex = 0; trackIndex < mp4CompilerState.tracks.length; trackIndex++) {

            const track = mp4CompilerState.tracks[trackIndex];

            console.log("\n--------------------------------------------");
            console.log(`TRACK ${trackIndex} (${track.semanticCore.codec.codec})`);
            console.log("--------------------------------------------");

            try {

                deriveStructuralStateInPlace({ track });
                buildStblChildIntentsWithoutOffsetsInPlace({ track });

                track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
                track.storedIntent.minfIntent = buildMinfIntentFromTrack({ track });
                track.storedIntent.mdiaIntent = buildMdiaIntentFromTrack({ track });

                const trakIntent =
                    buildTrakIntentFromTrakAndMvhd({
                        track,
                        mvhd: mp4CompilerState.storedIntent.mvhd
                    });

                // ---------------------------------------------------------
                // Emit compiler trak
                // ---------------------------------------------------------
                const compilerTrakBytes =
                    serializeBoxTree(
                        EmitterRegistry.assemble("moov/trak", trakIntent)
                    );

                // ---------------------------------------------------------
                // Extract ELST — oracle
                // ---------------------------------------------------------
                const oracleElstExtractor =
                    getGoldenTruthBox
                        .getSemanticBoxDataByPathFromMp4File(
                            mp4Bytes,
                            `moov/trak[${trackIndex}]/edts/elst`
                        );

                const oracleElstBytes =
                    oracleElstExtractor.readBoxReport().raw;

                // ---------------------------------------------------------
                // Extract ELST — compiler
                // ---------------------------------------------------------
                const compilerElstExtractor =
                    getGoldenTruthBox.getSemanticBoxDataFromBox({
                        boxBytes: compilerTrakBytes,
                        sourceRegistryKey: "moov/trak",
                        targetBoxPath: "moov/trak/edts/elst"
                    });

                const compilerElstBytes =
                    compilerElstExtractor.readBoxReport().raw;

                // ---------------------------------------------------------
                // Intent sanity (always log)
                // ---------------------------------------------------------
                const oracleIntent = oracleElstExtractor.getEmitterInput();
                const compilerIntent = compilerElstExtractor.getEmitterInput();

                console.log("ORACLE elst intent:", oracleIntent);
                console.log("COMPILER elst intent:", compilerIntent);

                console.log("ORACLE elst header:",
                    oracleElstExtractor.readBoxReport().box.header);
                console.log("COMPILER elst header:",
                    compilerElstExtractor.readBoxReport().box.header);

                // ---------------------------------------------------------
                // Decode first ELST entry (oracle vs compiler)
                // ---------------------------------------------------------
                const oracleEntry = oracleIntent.entries[0];
                const compilerEntry = compilerIntent.entries[0];

                console.log("ORACLE decoded elst entry", {
                    editDuration: oracleEntry.editDuration,
                    mediaTime: oracleEntry.mediaTime,
                    mediaRate:
                        oracleEntry.mediaRateInteger +
                        oracleEntry.mediaRateFraction / 65536
                });

                console.log("COMPILER decoded elst entry", {
                    editDuration: compilerEntry.editDuration,
                    mediaTime: compilerEntry.mediaTime,
                    mediaRate:
                        compilerEntry.mediaRateInteger +
                        compilerEntry.mediaRateFraction / 65536
                });

                // ---------------------------------------------------------
                // Byte-for-byte comparison (non-fatal)
                // ---------------------------------------------------------
                const diffs = [];

                const byteCount =
                    Math.max(
                        oracleElstBytes.length,
                        compilerElstBytes.length
                    );

                for (let i = 0; i < byteCount; i++) {
                    assertEqualHexCollect(
                        diffs,
                        `track[${trackIndex}].elst.byte[${i}]`,
                        compilerElstBytes[i],
                        oracleElstBytes[i]
                    );
                }

                if (diffs.length) {
                    console.table(diffs);
                    failures.push({
                        fixture,
                        trackIndex,
                        codec: track.semanticCore.codec.codec,
                        diffCount: diffs.length,
                        diffs
                    });
                }

            } catch (err) {
                failures.push({
                    fixture,
                    trackIndex,
                    codec: track.semanticCore.codec.codec,
                    error: err
                });
                console.error("ERROR:", err);
            }
        }
    }

    // ---------------------------------------------------------
    // Final result
    // ---------------------------------------------------------
    if (failures.length) {
        console.error("\n================ ELST FAILURES ================");
        for (const f of failures) {
            console.error(
                `Fixture ${f.fixture}, track ${f.trackIndex} (${f.codec})`,
                f.error ? f.error : `${f.diffCount} byte diffs`
            );
        }
        throw new Error(
            `ELST mismatch: ${failures.length} failing track(s)`
        );
    }
}
