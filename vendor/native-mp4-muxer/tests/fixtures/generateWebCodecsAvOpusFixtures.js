import {
    runWebCodecsAudioVideoTestClient
} from "../clients/webcodecsReferenceAudioVideoSourceClient.js";

/**
 * generateWebCodecsAvOpusFixtures
 *
 * PURPOSE
 * -------
 * - Produce deterministic, frozen fixtures from WebCodecs output
 * - Capture:
 *   - access unit metadata (pts, isKey)
 *   - raw encoded payload bytes (Uint8Array)
 *
 * This is NOT a test.
 * This is a manual fixture generator.
 */
export async function generateWebCodecsAvOpusFixtures() {

    const { tracks } = await runWebCodecsAudioVideoTestClient();

    if (!Array.isArray(tracks)) {
        throw new Error("Expected tracks array from WebCodecs client");
    }

    const fixtures = tracks.map((track, trackIndex) => {

        const codec = track.semanticCore.codec.codec;
         console.log('codec', codec);

        let dOps = null;

        if ( codec === "opus" && track.semanticCore.codec.dOps instanceof Uint8Array) {
            dOps = Array.from(track.semanticCore.codec.dOps);
        }
        else {
            console.log("dOps is null");
        }

        const accessUnits = track.semanticCore.accessUnits;
        const payloads = track.payloads.accessUnitPayloads;

        if (!Array.isArray(accessUnits)) {
            throw new Error(`track ${trackIndex}: missing accessUnits`);
        }

        if (!Array.isArray(payloads)) {
            throw new Error(`track ${trackIndex}: missing accessUnitPayloads`);
        }

        if (accessUnits.length !== payloads.length) {
            throw new Error(
                `track ${trackIndex}: accessUnits/payloads length mismatch`
            );
        }

        return {
            trackIndex,
            codec,

            dOps,

            accessUnits: accessUnits.map((au, i) => ({
                pts: au.pts,
                isKey: au.isKey ?? null,
                payloadLength: payloads[i].byteLength
            })),

            payloads: payloads.map(bytes =>
                Array.from(bytes) // JSON-safe
            )
        };
    });

    // INTENTIONAL:
    // - copied manually into fixture files
    // - committed once
    // - never regenerated casually
    console.log(
        "WEBCODECS_AV_OPUS_FIXTURE =",
        JSON.stringify(fixtures, null, 2)
    );
}
