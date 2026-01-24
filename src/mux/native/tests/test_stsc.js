import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * STSC — Evolution Notes and Forward Plan
 * =======================================
 *
 * This file currently validates the STSC (Sample-To-Chunk) box
 * under the historical assumption that a *single-entry STSC table*
 * is sufficient.
 *
 * That assumption was valid when Framesmith only supported
 * single-track, video-only MP4s.
 *
 * It is no longer valid.
 *
 * ------------------------------------------------------------------
 * Historical context
 * ------------------------------------------------------------------
 *
 * Originally, Framesmith:
 * - supported only video tracks (avc1)
 * - emitted MP4s where:
 *
 *     stsd.entry_count = 1
 *     stsc.entry_count = 1
 *
 * This matched ffmpeg output for simple, video-only files and allowed
 * the STSC builder to use a minimal, canonical layout:
 *
 *   first_chunk = 1
 *   samples_per_chunk = 1
 *   sample_description_index = 1
 *
 * That design choice was pragmatic and correct *at the time*.
 *
 * ------------------------------------------------------------------
 * What changed: proper audio support
 * ------------------------------------------------------------------
 *
 * Framesmith now supports:
 *
 * - multiple tracks (video + audio)
 * - proper mp4a audio sample entries
 * - golden truth extraction per track using:
 *
 *     options.trackType = "video" | "audio"
 *
 * This change was implemented correctly and consistently across
 * the system:
 *
 * 1. STSD is no longer a single generic emitter.
 *
 *    Instead, it is split into two distinct emitters with different
 *    contracts:
 *
 *      - emitStsdAvc1Box  (video)
 *      - emitStsdMp4aBox  (audio)
 *
 *    These boxes are *not interchangeable*:
 *    - avc1 is a VisualSampleEntry
 *    - mp4a is an AudioSampleEntry
 *
 *    Treating them as a single emitter was incorrect and has now
 *    been fixed.
 *
 * 2. Golden truth extraction paths now reflect this distinction:
 *
 *      moov/trak/mdia/minf/stbl/stsd[avc1]
 *      moov/trak/mdia/minf/stbl/stsd[mp4a]
 *
 *    These registry-qualified paths allow the extractor to:
 *    - select the correct STSD box
 *    - delegate to the correct emitter
 *    - preserve a closed, explicit contract
 *
 * 3. Golden truth extractors already support multi-track traversal
 *    via options.trackType.
 *
 *    That means:
 *    - the box model supports multiple tracks
 *    - the extractor registry supports multiple tracks
 *    - STSD now supports multiple codecs cleanly
 *
 * ------------------------------------------------------------------
 * Why STSC must evolve next
 * ------------------------------------------------------------------
 *
 * STSC maps:
 *
 *   chunk_number → samples_per_chunk → sample_description_index
 *
 * In real-world MP4s (especially with audio):
 *
 * - STSC frequently contains *multiple entries*
 * - ffmpeg emits multi-entry STSC tables for audio tracks
 * - single-entry STSC is an optimization, not a rule
 *
 * The current STSC builder and tests still assume:
 *
 *     entry_count === 1
 *
 * That assumption now breaks:
 *
 * - STBL golden truth extraction for audio
 * - locked-layout equivalence for audio tracks
 * - semantic correctness when rebuilding real MP4s
 *
 * This is not an architectural constraint.
 * It is a historical simplification that has reached its limit.
 *
 * ------------------------------------------------------------------
 * Forward plan (intentional and explicit)
 * ------------------------------------------------------------------
 *
 * STSC will be evolved to support *multi-entry tables* directly.
 *
 * Concretely:
 *
 * - emitStscBox will be extended to accept:
 *
 *     {
 *       entries: [
 *         { firstChunk, samplesPerChunk, sampleDescriptionIndex },
 *         ...
 *       ]
 *     }
 *
 * - entry_count will be derived from entries.length
 * - no semantic collapsing or inference will occur
 * - the emitted STSC will match ffmpeg byte-for-byte when provided
 *   with golden truth input
 *
 * Tests in this file will be updated to:
 *
 * - validate both single-entry and multi-entry STSC layouts
 * - remove legacy guards that reject entryCount !== 1
 * - reflect the same level of correctness already achieved for STSD
 *
 * ------------------------------------------------------------------
 * Guiding principle
 * ------------------------------------------------------------------
 *
 * This evolution follows the same pattern already proven correct
 * for STSD:
 *
 * - no polymorphic emitters
 * - no hidden inference
 * - no codec-agnostic lies
 *
 * Instead:
 * - explicit contracts
 * - data-preserving golden truth extraction
 * - emitters that reflect real MP4 structure
 *
 * STSC is simply the next box to be brought up to that standard.
 */

export async function testStsc_Structure() {

    // Canonical single-entry layout
    const layout = {
        entries: [
            {
                firstChunk: 1,
                samplesPerChunk: 1,
                sampleDescriptionIndex: 1
            }
        ]
    };

    const node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsc",
            layout
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("stsc.type", node.type, "stsc");
    assertEqual("stsc.version", node.version, 0);
    assertEqual("stsc.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body shape
    // ---------------------------------------------------------
    // entry_count + 3 fields for the single entry
    assertEqual("stsc.body.length", node.body.length, 4);

    // ---------------------------------------------------------
    // Entry count
    // ---------------------------------------------------------
    assertEqual(
        "stsc.entry_count",
        node.body[0].int,
        1
    );

    // ---------------------------------------------------------
    // Entry values
    // ---------------------------------------------------------
    assertEqual(
        "stsc.first_chunk",
        node.body[1].int,
        1
    );

    assertEqual(
        "stsc.samples_per_chunk",
        node.body[2].int,
        1
    );

    assertEqual(
        "stsc.sample_description_index",
        node.body[3].int,
        1
    );

    // ---------------------------------------------------------
    // Defensive immutability
    // ---------------------------------------------------------
    layout.entries[0].firstChunk = 999;

    assertEqual(
        "stsc.immutability",
        node.body[1].int,
        1
    );
}

export async function testStsc_Conformance() {

    // -------------------------------------------------------------
    // Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // Read reference STSC via dispatcher
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsc"
    );

    const refFields  = ref.readBoxReport();
    const params     = ref.getEmitterInput();
    const refEntries = refFields.box.fields.entries;

    // -------------------------------------------------------------
    // Rebuild STSC using builder
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsc",
            params
        )
    );

    // -------------------------------------------------------------
    // Read rebuilt STSC using extractor directly (no leaf guessing)
    // -------------------------------------------------------------
    const extractor =
        GoldenTruthRegistry.getExtractor(
            "moov/trak/mdia/minf/stbl/stsc"
        );

    const out = extractor.readBoxReport(outBytes);

    // -------------------------------------------------------------
    // Field-level conformance
    // -------------------------------------------------------------
    assertEqual(
        "stsc.entry_count",
        out.box.entryCount,
        refFields.box.entryCount
    );

    const outEntries = out.box.fields.entries;

    assertEqual(
        "stsc.entry_count",
        outEntries.length,
        refEntries.length
    );

    for (let i = 0; i < refEntries.length; i++) {
        const refEntry = refEntries[i];
        const outEntry = outEntries[i];

        assertEqual(
            `stsc.entries[${i}].firstChunk`,
            outEntry.firstChunk,
            refEntry.firstChunk
        );

        assertEqual(
            `stsc.entries[${i}].samplesPerChunk`,
            outEntry.samplesPerChunk,
            refEntry.samplesPerChunk
        );

        assertEqual(
            `stsc.entries[${i}].sampleDescriptionIndex`,
            outEntry.sampleDescriptionIndex,
            refEntry.sampleDescriptionIndex
        );
    }

    // -------------------------------------------------------------
    // Byte-for-byte conformance
    // -------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "stsc.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `stsc.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }
}
