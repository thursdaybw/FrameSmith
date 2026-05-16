import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertEqualHexCollect, } from "./assertions.js";
import { assertBytesWithStubbedStco } from "./assertBytesWithStubbedStco.js";

/**
 * A whole bunch of boilerplate in here to extract child boxes and assert them
 * and yet it still can't assert child order. and so assertBytesWithStubbedStco()
 * was born.. I haven't removed the old boiler plate an assertions yet, 
 * but they're not necessary.
 */
export async function testNativeMuxer_STBL_Children_Except_STCO_Equals_FFmpegOracle() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4",
    ];

    for (const fixture of fixtures) {

        // ---------------------------------------------------------
        // Load oracle MP4
        // ---------------------------------------------------------
        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        // ---------------------------------------------------------
        // Run golden client (semantic inputs)
        // ---------------------------------------------------------
        const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

        // ---------------------------------------------------------
        // Compiler up to STBL (no offsets)
        // ---------------------------------------------------------
        prepareTracksForStructuralDerivation({ mp4CompilerState });

        for (const track of mp4CompilerState.tracks) {
            deriveStructuralStateInPlace({ track });
            buildStblChildIntentsWithoutOffsetsInPlace({ track });
            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
        }

        // ---------------------------------------------------------
        // Per-track STBL comparison (excluding STCO)
        // ---------------------------------------------------------
        for (let trackIndex = 0; trackIndex < mp4CompilerState.tracks.length; trackIndex++) {

            const track = mp4CompilerState.tracks[trackIndex];

            // Emit compiler STBL
            const compilerStblBytes = serializeBoxTree(EmitterRegistry.assemble("moov/trak/mdia/minf/stbl", track.storedIntent.stblIntent));

            // Extract oracle STBL
            const oracleStblReport =
                getGoldenTruthBox
                    .getSemanticBoxDataByPathFromMp4File(
                        mp4Bytes,
                        `moov/trak[${trackIndex}]/mdia/minf/stbl`
                    )
                    .readBoxReport();

            const oracleStblBytes = oracleStblReport.raw;

            // -----------------------------------------------------
            // Decode child boxes from both STBLs
            // -----------------------------------------------------
            const compilerChildren = extractTopLevelStblChildReports({ stblBytes: compilerStblBytes });
            const oracleChildren = extractTopLevelStblChildReports({ stblBytes: oracleStblBytes });

            // -----------------------------------------------------
            // Compare all children except STCO
            // -----------------------------------------------------
            for (const [type, compilerBox] of Object.entries(compilerChildren)) {

                if (type === "stco") {
                    continue; // intentionally stubbed
                }

                const oracleBox = oracleChildren[type];

                if (!oracleBox) {
                    throw new Error(
                        `${fixture}: missing oracle ${type} in STBL (track ${trackIndex})`
                    );
                }

                const diffs = [];
                const byteCount =
                    Math.max(compilerBox.raw.length, oracleBox.raw.length);

                for (let i = 0; i < byteCount; i++) {
                    assertEqualHexCollect(
                        diffs,
                        `${fixture}: stbl.${type}.byte[${i}] (track ${trackIndex})`,
                        compilerBox.raw[i],
                        oracleBox.raw[i]
                    );
                }

                if (diffs.length) {
                    console.table(diffs.slice(0, 50));
                    throw new Error(
                        `${fixture}: STBL child ${type} mismatch (${diffs.length} bytes differ, track ${trackIndex})`
                    );
                }
            }

            // -----------------------------------------------------
            // Structural assertion for stubbed STCO
            // -----------------------------------------------------
            const stcoBox = compilerChildren.stco;

            if (!stcoBox) {
                throw new Error(
                    `${fixture}: compiler STBL missing stco (track ${trackIndex})`
                );
            }

            const expectedEntryCount = track.chunks.length;

            const raw = stcoBox.raw;

            const reportedEntryCount = (raw[12] << 24) | (raw[13] << 16) | (raw[14] << 8)  | raw[15];

            if (reportedEntryCount !== expectedEntryCount) {
                throw new Error(
                    `${fixture}: stco entry count mismatch (expected ${expectedEntryCount}, got ${reportedEntryCount}, track ${trackIndex})`
                );
            }

            assertBytesWithStubbedStco({
                fixture,
                compilerBytes: compilerStblBytes,
                oracleBytes: oracleStblBytes,
                expectedStcoEntryCount: track.chunks.length,
                labelPrefix: `fixture ${fixture} track[${trackIndex}].stbl`,
                containerHeaderSize: 8
            });

        }

    }
}


/**
 * Extracts BoxReports for all direct STBL children
 * from a serialized STBL box.
 *
 * Returns:
 * {
 *   stsd?: BoxReport,
 *   stts?: BoxReport,
 *   stsc?: BoxReport,
 *   stsz?: BoxReport,
 *   stco?: BoxReport,
 *   ctts?: BoxReport,
 *   stss?: BoxReport,
 *   sgpd?: BoxReport,
 *   sbgp?: BoxReport,
 * }
 */
export function extractTopLevelStblChildReports({ stblBytes }) {

    if (!(stblBytes instanceof Uint8Array)) {
        throw new Error(
            "extractTopLevelStblChildReports: stblBytes must be Uint8Array"
        );
    }

    const children = {};
    const childTypes = [
        "stsd",
        "stts",
        "stsc",
        "stsz",
        "stco",
        "ctts",
        "stss",
        "sgpd",
        "sbgp",
    ];

    for (const type of childTypes) {
        try {
            const report =
                getGoldenTruthBox
                    .getSemanticBoxDataFromBox({
                        boxBytes: stblBytes,
                        sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                        targetBoxPath: `moov/trak/mdia/minf/stbl/${type}`,
                    })
                    .readBoxReport();

            children[type] = report;

        } catch (err) {
            // child not present or not supported — valid
        }
    }

    return children;
}


