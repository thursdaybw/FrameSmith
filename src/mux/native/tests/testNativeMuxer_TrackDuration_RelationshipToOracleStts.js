import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";
import { extractTrackDurationFromOracleStts } from "./reference/extractTrackDurationFromOracleStts.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { getSumOfAccessUnitDurations } from "../compiler/compileMp4.js";
import { assertEqual } from "./assertions.js";

export async function testNativeMuxer_TrackDuration_Relationships_AllFixtures() {

    // =========================================================
    // reference_av — video track (track 0)
    // =========================================================
    {
        const resp = await fetch("reference/reference_av.mp4");
        const mp4 = new Uint8Array(await resp.arrayBuffer());

        const accessUnits = extractSemanticAccessUnitsFromMp4({
            mp4Bytes: mp4,
            trackIndex: 0
        });

        const sum = getSumOfAccessUnitDurations(accessUnits);

        const oracle = extractTrackDurationFromOracleStts({
            mp4Bytes: mp4,
            zeroBasedTrackIndex: 0
        });

        assertEqual(
            "reference_av video track duration equals STTS total",
            sum,
            oracle
        );
    }

    // =========================================================
    // reference_av — audio track (track 1)
    // =========================================================
    {
        const resp = await fetch("reference/reference_av.mp4");
        const mp4 = new Uint8Array(await resp.arrayBuffer());

        const accessUnits = extractSemanticAccessUnitsFromMp4({
            mp4Bytes: mp4,
            trackIndex: 1
        });

        const sum = getSumOfAccessUnitDurations(accessUnits);

        const oracle = extractTrackDurationFromOracleStts({
            mp4Bytes: mp4,
            zeroBasedTrackIndex: 1
        });

        assertEqual(
            "reference_av audio track duration equals STTS total",
            sum,
            oracle
        );
    }

    // =========================================================
    // reference_av_opus — video track (track 0)
    // =========================================================
    {
        const resp = await fetch("reference/reference_av_opus.mp4");
        const mp4 = new Uint8Array(await resp.arrayBuffer());

        const accessUnits = extractSemanticAccessUnitsFromMp4({
            mp4Bytes: mp4,
            trackIndex: 0
        });

        const sum = getSumOfAccessUnitDurations(accessUnits);

        const oracle = extractTrackDurationFromOracleStts({
            mp4Bytes: mp4,
            zeroBasedTrackIndex: 0
        });

        assertEqual(
            "reference_av_opus video track duration equals STTS total",
            sum,
            oracle
        );
    }

    // =========================================================
    // reference_av_opus — audio track (track 1)
    // =========================================================
    {
        const resp = await fetch("reference/reference_av_opus.mp4");
        const mp4 = new Uint8Array(await resp.arrayBuffer());

        const accessUnits = extractSemanticAccessUnitsFromMp4({
            mp4Bytes: mp4,
            trackIndex: 1
        });

        const sum = getSumOfAccessUnitDurations(accessUnits);

        const oracle = extractTrackDurationFromOracleStts({
            mp4Bytes: mp4,
            zeroBasedTrackIndex: 1
        });

        assertEqual(
            "reference_av_opus audio track duration equals STTS total",
            sum,
            oracle
        );
    }
}
