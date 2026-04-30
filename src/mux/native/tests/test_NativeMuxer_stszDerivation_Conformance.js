import { deriveStszIntentFromPayloads } from "../derivers/deriveStszIntentFromPayloads.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";
import {
    assertEqual,
    assertExists,
    assertEqualHex,
    assertObjectEqual
} from "./assertions.js";

export async function testNativeMuxer_DeriveStsz_Conformance_ffmpeg() {

    const fixtures = [
        "reference/reference_av.mp4",       // mp4a
        "reference/reference_av_opus.mp4"   // opus
    ];

    for (const fixture of fixtures) {

        // ---------------------------------------------------------
        // 1. Load oracle MP4
        // ---------------------------------------------------------
        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        // ---------------------------------------------------------
        // 2. Run golden client
        // ---------------------------------------------------------
        const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });

        // audio track = index 1 in both fixtures
        const track = tracks[1];

        // ---------------------------------------------------------
        // 3. Derive STSZ intent (function under test)
        // ---------------------------------------------------------
        const stszIntent = deriveStszIntentFromPayloads({
                accessUnits: track.semanticCore.accessUnits,
                accessUnitPayloads: track.payloads.accessUnitPayloads
            });

        assertExists(`${fixture}: stsz intent`, stszIntent);

        // ---------------------------------------------------------
        // 4. Emit STSZ directly from derived intent
        // ---------------------------------------------------------
        const variant =
            stszIntent.sampleSize === 0 ? "variable" : "fixed";

        const outStszBytes =
            serializeBoxTree(
                EmitterRegistry.emit(
                    `moov/trak/mdia/minf/stbl/stsz|${variant}`,
                    stszIntent
                )
            );

        // ---------------------------------------------------------
        // 5. Extract oracle STSZ
        // ---------------------------------------------------------
        const oracleReport =
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    "moov/trak[1]/mdia/minf/stbl/stsz"
                )
                .readBoxReport();

        const oracleBytes = oracleReport.raw;

        // ---------------------------------------------------------
        // 6. Byte-for-byte equivalence
        // ---------------------------------------------------------
        assertEqual(
            `${fixture}: stsz.size`,
            outStszBytes.length,
            oracleBytes.length
        );

        for (let i = 0; i < oracleBytes.length; i++) {
            assertEqualHex(
                `${fixture}: stsz.byte[${i}]`,
                outStszBytes[i],
                oracleBytes[i]
            );
        }
    }
}
