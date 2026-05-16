import { deriveSamplesFromStbl }
    from "./goldenTruthExtractors/stbl/deriveSamplesFromStbl.js";

import { adaptSttsFromSamples }
    from "../adapters/adaptSttsFromSamples.js";

import { serializeBoxTree }
    from "../serializer/serializeBoxTree.js";

import { EmitterRegistry }
    from "../box-emitters/EmitterRegistry.js";

import { getGoldenTruthBox }
    from "./goldenTruthExtractors/index.js";

import { assertEqual } from "./assertions.js";

async function loadWebCodecsFixtures() {
    const resp = await fetch(
        "./fixtures/webcodecs_opus_av_access_units.json"
    );
    return await resp.json();
}

export async function testNativeMuxer_Opus_STBL_WebCodecsShapeCompatibility() {


    console.warn("delete /tests/goldenTruthExtractors/stbl/deriveSamplesOnePerPacketFromStbl.js, it was a hack for testing an incompatible oracne");

    // ---------------------------------------------------------
    // 1. Load Opus oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract STBL bytes for Opus track (track 1)
    // ---------------------------------------------------------
    const stblBytes =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[1]/mdia/minf/stbl"
            )
            .readBoxReport()
            .raw;

    // ---------------------------------------------------------
    // 3. Derive per-sample samples from STBL
    // ---------------------------------------------------------
    const samples = deriveSamplesFromStbl(stblBytes);

    // ---------------------------------------------------------
    // 4. Adapt samples → STTS entries
    // ---------------------------------------------------------
    const { entries } = adaptSttsFromSamples({ samples });

    // ---------------------------------------------------------
    // 5. Emit STTS box
    // ---------------------------------------------------------
    const outSttsBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stts",
                { entries }
            )
        );

    // ---------------------------------------------------------
    // 6. Extract reference STTS bytes
    // ---------------------------------------------------------
    const refStts =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[1]/mdia/minf/stbl/stts"
            )
            .readBoxReport()
            .raw;

    // ---------------------------------------------------------
    // 7. Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual( "stts.size", outSttsBytes.length, refStts.length);

    for (let i = 0; i < refStts.length; i++) {
        assertEqual( `stts.byte[${i}]`, outSttsBytes[i], refStts[i]);
    }

    // ---------------------------------------------------------
    // STCO compatibility pre-assurance 
    // ---------------------------------------------------------

    const oracleStscEntries =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsc"
        )
        .readBoxReport()
        .box.fields.entries;

    const oracleChunkOffsets =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stco"
        )
        .readBoxReport()
        .box.fields.chunkOffsets;

    // expand oracle STSC → samplesPerChunk[]
    const oracleSamplesPerChunk = [];
    let totalSamples = 0;

    for (let i = 0; i < oracleStscEntries.length; i++) {
        const entry = oracleStscEntries[i];
        const next  = oracleStscEntries[i + 1];

        const firstChunk = entry.firstChunk - 1;
        const lastChunk =
            next ? next.firstChunk - 2 : oracleChunkOffsets.length - 1;

        for (let c = firstChunk; c <= lastChunk; c++) {
            oracleSamplesPerChunk[c] = entry.samplesPerChunk;
            totalSamples += entry.samplesPerChunk;
        }
    }

    assertEqual(
        "oracle STCO consumes whole WebCodecs frames",
        totalSamples,
        samples.length
    );

    // ---------------------------------------------------------
    // Sanity check: WebCodecs AU *shape* compatibility
    // ---------------------------------------------------------

    const webcodecsFixtures = await loadWebCodecsFixtures();
    const webcodecsTrack =
        webcodecsFixtures.find(t => t.trackIndex === 1);

    if (!webcodecsTrack) {
        throw new Error("WebCodecs Opus track not found");
    }

    const wc = webcodecsTrack.accessUnits;

    // monotonic PTS
    for (let i = 1; i < wc.length; i++) {
        assertEqual(
            `webcodecs pts monotonic [${i}]`,
            wc[i].pts > wc[i - 1].pts,
            true
        );
    }

    for (let i = 1; i < samples.length; i++) {
        assertEqual(
            `stbl pts monotonic [${i}]`,
            samples[i].pts > samples[i - 1].pts,
            true
        );
    }

    // constant frame duration (excluding tail)
    const wcDelta = wc[1].pts - wc[0].pts;
    for (let i = 1; i < wc.length - 1; i++) {
        const delta = wc[i + 1].pts - wc[i].pts;

        assertEqual(
            `webcodecs frame delta stable [${i}]`,
            Math.abs(delta - wcDelta) <= 1,
            true
        );
    }

    const stblDelta = samples[1].pts - samples[0].pts;
    for (let i = 1; i < samples.length - 1; i++) {
        assertEqual(
            `stbl frame delta [${i}]`,
            samples[i + 1].pts - samples[i].pts,
            stblDelta
        );
    }

}
