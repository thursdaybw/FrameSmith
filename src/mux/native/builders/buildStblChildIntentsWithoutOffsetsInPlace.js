import { adaptStscEntriesToEmitterParams } from "../adapters/adaptStscEntriesToEmitterParams.js";
import { deriveSyncSampleNumbers } from "../derivers/deriveSyncSampleNumbers.js";
import { adaptSttsFromSamples } from "../adapters/adaptSttsFromSamples.js";
import { deriveStszIntentFromPayloads }  from "../derivers/deriveStszIntentFromPayloads.js";
import { adaptCttsFromSamples } from "../adapters/adaptCttsFromSamples.js";
import { buildStsdIntentFromSemanticTrack } from "../builders/buildStsdIntentFromSemanticTrack.js";
import { applySyncRepresentationPolicy } from "../policies/applySyncRepresentationPolicy.js";
import { buildSyncRepresentationIntent } from "../builders/buildSyncRepresentationIntent.js";

export function buildStblChildIntentsWithoutOffsetsInPlace({ track }) {

    // -- Chunk mapping
    // ---------------------------------------------------------
    // Derive sync sample numbers (semantic fact)
    // ---------------------------------------------------------
    // tests:
    //    testNativeMuxer_WhenGivenSemanticInputsPlusOracleContainerTopology_MustReproduceStscByteForByte_Opus
    //    testNativeMuxer_WhenGivenSemanticInputsPlusOracleContainerSuppliedHints_MustReproduceStscByteForByte_Mp4a
    track.storedIntent.stscParams = adaptStscEntriesToEmitterParams({ stscEntries: track.stscEntries, chunks: track.chunks });

    // ---------------------------------------------------------
    // Derive sync sample numbers (semantic fact)
    // ---------------------------------------------------------
    track.derivedSyncSampleNumbers = deriveSyncSampleNumbers({ samples: track.semanticCore.accessUnits });

    // =====================================================================
    // Tier 3 — Adaptation (semantic → emitter parameters)
    // =====================================================================

    // -- Time-to-sample
    // adpaptSttsFromSamples tested in 
    //testNativeMuxer_Opus_STBL_WebCodecsShapeCompatibility
    //   (proves stts byte for byte via adaptSttsFromSamples
    //
    //testNativeMuxer_AdaptSttsFromSamples_CFR
    //testNativeMuxer_AdaptSttsFromSamples_VariableDurationGroups
    const sttsPolicy = track.buildHints?.sttsPolicy ?? "duration-collapsed";
    track.storedIntent.sttsParams = adaptSttsFromSamples({
        samples: track.semanticCore.accessUnits,
        inputTrackDurationInTrackTimescale:
        track.semanticHints?.inputTrackDurationInTrackTimescale
    });

    // -- Sample sizes
    // test: testNativeMuxer_DeriveStsz_Conformance_ffmpeg
    track.storedIntent.stszParams = deriveStszIntentFromPayloads({ accessUnits: track.semanticCore.accessUnits, accessUnitPayloads: track.payloads.accessUnitPayloads });

    // -- Composition offsets
    track.storedIntent.cttsParams = adaptCttsFromSamples({ samples: track.semanticCore.accessUnits });
    track.hasNonZeroCompositionOffset = track.storedIntent.cttsParams.entries.some(e => e.offset !== 0);

    // =====================================================================
    // Tier 4 — Container Policies (explicit, named decisions)
    // =====================================================================
    track.storedIntent.stsd = buildStsdIntentFromSemanticTrack({
        codecName: track.semanticCore.codec.codec,
        semanticCodec: track.semanticCore.codec,
        buildParameters: track.buildParameters,
        buildHints: track.buildHints
    });

    // ---------------------------------------------------------
    // Sync sample representation policy (stss vs none)
    // ---------------------------------------------------------
    const syncRepresentation = applySyncRepresentationPolicy({
        derivedSyncSampleNumbers: track.derivedSyncSampleNumbers,
        buildHints: track.buildHints
    });
    track.storedIntent.syncIntent =  buildSyncRepresentationIntent(syncRepresentation);



    return track;
}
