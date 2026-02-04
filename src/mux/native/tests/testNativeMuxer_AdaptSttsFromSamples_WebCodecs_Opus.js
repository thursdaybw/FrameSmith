import { adaptSttsFromSamples }
    from "../adapters/adaptSttsFromSamples.js";

import { serializeBoxTree }
    from "../serializer/serializeBoxTree.js";

import { EmitterRegistry }
    from "../box-emitters/EmitterRegistry.js";

import { assertEqual }
    from "./assertions.js";

import { normalizeAccessUnitsInPlace }
    from "../normalization/access-units/index.js";

async function loadWebCodecsFixtures() {
    const resp = await fetch(
        "./fixtures/webcodecs_opus_av_access_units.json"
    );
    return await resp.json();
}

export async function testNativeMuxer_AdaptSttsFromSamples_WebCodecs_Opus() {

    const webcodecsFixtures = await loadWebCodecsFixtures();

    // ---------------------------------------------------------
    // Select Opus track from fixture (trackIndex === 1)
    // ---------------------------------------------------------
    const opusTrack =
        webcodecsFixtures.find(t => t.trackIndex === 1);

    if (!opusTrack) {
        throw new Error("Opus track not found in webcodecs fixture");
    }

    const samples =
        opusTrack.accessUnits.map(u => ({
            pts: u.pts,
            duration: u.duration
        }));

    normalizeAccessUnitsInPlace({
        accessUnits: samples,
        codec: "opus"
    });

    // ---------------------------------------------------------
    // Adapt → STTS intent
    // ---------------------------------------------------------
    const { entries } =
        adaptSttsFromSamples({ samples });

    // ---------------------------------------------------------
    // Emit STTS
    // ---------------------------------------------------------
    const sttsBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stts",
                { entries }
            )
        );

    // ---------------------------------------------------------
    // Re-emit to prove determinism
    // ---------------------------------------------------------
    const sttsBytesAgain =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stts",
                { entries }
            )
        );

    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual(
        "stts.size",
        sttsBytes.length,
        sttsBytesAgain.length
    );

    for (let i = 0; i < sttsBytes.length; i++) {
        assertEqual(
            `stts.byte[${i}]`,
            sttsBytes[i],
            sttsBytesAgain[i]
        );
    }
}
