import { normalizeAccessUnitsInPlace } from "../normalization/access-units/index.js";
import { deriveStructuralStateInPlace } from "./deriveStructuralStateInPlace.js";

import { applyAvcCContainerPolicy }
    from "../policies/applyAvcCContainerPolicy.js";

import { applyBtrtContainerPolicy }
    from "../policies/applyBtrtContainerPolicy.js";

import { applyTrackHandlerPolicy }
    from "../policies/applyTrackHandlerPolicy.js";

import { applyMovieTimingPolicy }
    from "../policies/applyMovieTimingPolicy.js";

import { applyEditListPolicy }
    from "../policies/applyEditListPolicy.js";

import { applyTrackHeaderPolicy }
    from "../policies/applyTrackHeaderPolicy.js";

import { applyCompressorNamePolicy }
    from "../policies/applyCompressorNamePolicy.js";

import { applyUdtaPolicy }
    from "../policies/applyUdtaPolicy.js";

import { adaptSttsFromSamples } from "../adapters/adaptSttsFromSamples.js";

import { adaptStszSizesFromPayloads } from "../adapters/adaptStszSizesFromPayloads.js";

import { adaptCttsFromSamples } from "../adapters/adaptCttsFromSamples.js";

import { adaptStscEntriesToEmitterParams } from "../adapters/adaptStscEntriesToEmitterParams.js";

import { adaptCodecConfigurationToStsdParams } from "../adapters/adaptCodecConfigurationToStsdParams.js";

import { assembleMdatPayloadFromChunks } from "../assembleMdatPayloadFromChunks.js";

import { emitStcoBox } from "../box-emitters/stcoBox.js";

import { emitStsdBox } from "../box-emitters/stsdBox.js";
import { emitFtypBox } from "../box-emitters/ftypBox.js";
import { emitMoovBox } from "../box-emitters/moovBox.js";
import { emitMvhdBox } from "../box-emitters/mvhdBox.js";
import { emitTrakBox } from "../box-emitters/trakBox.js";
import { emitMdiaBox } from "../box-emitters/mdiaBox.js";
import { emitMinfBox } from "../box-emitters/minfBox.js";
import { emitStblBox } from "../box-emitters/stblBox.js";
import { emitVmhdBox } from "../box-emitters/vmhdBox.js";
import { emitDinfBox } from "../box-emitters/dinfBox.js";
import { emitDrefBox } from "../box-emitters/drefBox.js";
import { emitMdhdBox } from "../box-emitters/mdhdBox.js";
import { emitHdlrBox } from "../box-emitters/hdlrBox.js";
import { emitTkhdBox } from "../box-emitters/tkhdBox.js";
import { emitSttsBox } from "../box-emitters/sttsBox.js";
import { emitCttsBox } from "../box-emitters/cttsBox.js";
import { emitStscBox } from "../box-emitters/stscBox.js";
import { emitStszBox } from "../box-emitters/stszBox.js";
import { emitUdtaBox } from "../box-emitters/udtaBox.js";
import { emitStssBox } from "../box-emitters/stssBox.js";
import { emitEdtsBox } from "../box-emitters/edtsBox.js";
import { emitElstBox } from "../box-emitters/elstBox.js";

import { resolvePhysicalLayout } from "../resolvePhysicalLayout.js";
import { commitMoovWithResolvedLayout } from "../commit/commitMoovWithResolvedLayout.js";
import { emitMp4FileFromResolvedParts } from "../emitMp4FileFromResolvedParts.js";

// INTERNAL: compiler implementation detail — use createMp4FromInputs() instead
/**
 * compileMp4
 * =============================
 *
 * INTERNAL PRODUCTION ENTRY POINT
 *
 * This function represents the canonical NativeMuxer compilation pipeline.
 *
 * All future source adapters (WebCodecs, MP4 demux, image sequences, etc.)
 * are expected to produce semantic inputs compatible with this function.
 *
 * Lower-level utilities (e.g. emitMp4FileFromResolvedParts) are implementation details.
 *
 * Assembles a complete MP4 file from frozen semantic inputs using the
 * NativeMuxer production pipeline.
 *
 * ---------------------------------------------------------------------------
 * Architectural Intent
 * ---------------------------------------------------------------------------
 *
 * This function is intentionally structured using a **hybrid layout**:
 *
 *   - PRIMARY AXIS: Architectural tiers (compiler pipeline)
 *   - SECONDARY AXIS: MP4 box responsibility within each tier
 *
 * The goal is to make *data flow* explicit while still allowing a reader
 * to reason locally about each MP4 box.
 *
 * This is a compiler-style assembly, not a builder-style assembly.
 *
 * ---------------------------------------------------------------------------
 * The Tiers
 * ---------------------------------------------------------------------------
 *
 * Tier 1 — Semantic Media Facts (Normalization)
 * ---------------------------------------------
 * Canonicalization of intrinsic media truths.
 *
 * This tier takes valid input and normalizes it into a complete,
 * internally consistent semantic model required by downstream stages.
 *
 * Normalization may:
 *   - assert and enforce invariants
 *   - fill required fields with the only valid value
 *   - make implicit facts explicit
 *
 * Normalization must NOT:
 *   - choose between multiple valid outcomes
 *   - apply container compatibility rules
 *   - derive structural layout
 *
 * Examples of normalized facts:
 *   - access units and their payloads
 *   - timestamps, durations, keyframes
 *   - codec identity and configuration
 *   - single sample description invariants
 *   - track- and movie-level timing metadata
 *
 * After this tier, downstream code must not ask:
 *   “is this present?” or “which one should I pick?”
 *
 * Tier 2 — Structural Derivation
 * ------------------------------
 * Deterministic structure derived from semantics:
 *   - chunk topology
 *   - sample grouping
 *   - sample numbering
 *   - track duration
 *
 * Tier 3 — Adaptation
 * -------------------
 * Shape translation from derived data into emitter-ready parameters.
 * No policy, no compatibility decisions.
 *
 * Tier 4 — Container Policies
 * ---------------------------
 * Explicit, named container-level decisions that are:
 *   - not semantic
 *   - not derivable
 *   - required for compatibility
 *
 * Tier 5 — Emission + Assembly
 * ----------------------------
 * Box emission, physical layout resolution, and final byte assembly.
 *
 * ---------------------------------------------------------------------------
 * Design Rules (Hard)
 * ---------------------------------------------------------------------------
 *
 * - No tier may reach "backward" to an earlier tier
 * - Policies must not be hidden inside adapters or emitters
 * - Emitters must be pure serializers
 * - This function defines *order*, not algorithms
 *
 * The structure here is deliberate and pedagogical.
 * Extraction into sub-functions will preserve tier boundaries.
 * 
 * compileMp4 assumes a validated Mp4BuildInput
 */
export function compileMp4({ mp4CompilerState }) {


    console.log(
        "DEBUG compiler semanticHints:",
        mp4CompilerState.semanticHints
    );

    /**
     *   Tier 1 — Semantic Media Facts (Normalization)
     *
     * Canonicalizes Mp4BuildInput into a complete, internally consistent form
     * required by the NativeMuxer compilation pipeline.
     *
     * -------------------------------------------------------------------------
     * Purpose
     * -------------------------------------------------------------------------
     *
     * Normalization exists to make downstream stages *boring*.
     *
     * After normalization:
     *   - all required fields are present
     *   - all invariants are enforced
     *   - any value with only ONE valid outcome is made explicit
     *
     * Downstream code must never need to ask:
     *   - “is this present?”
     *   - “which value should I choose?”
     *
     * -------------------------------------------------------------------------
     * What normalization IS
     * -------------------------------------------------------------------------
     *
     * Normalization:
     *   - enforces intrinsic media invariants
     *   - fills in required values when only one valid value exists
     *   - makes implicit facts explicit
     *
     * Normalization may:
     *   - assert constraints
     *   - copy, annotate, or reshape data
     *   - attach deterministic, unavoidable values
     *
     * -------------------------------------------------------------------------
     * What normalization is NOT
     * -------------------------------------------------------------------------
     *
     * Normalization must NOT:
     *   - choose between multiple valid outcomes
     *   - apply container compatibility rules
     *   - derive structural layout (chunks, tables, topology)
     *   - encode MP4 box representation
     *
     * If a decision has more than one valid answer:
     *   - it does NOT belong here
     *   - it is either a derivation strategy or a container policy
     *
     * -------------------------------------------------------------------------
     * Current invariants enforced
     * -------------------------------------------------------------------------
     *
     * At the current maturity of the system:
     *
     *   - exactly ONE sample description per track is supported
     *   - therefore, all samples MUST reference sampleDescriptionIndex = 1
     *
     * This is NOT a policy or a preference.
     * It is the only value that can produce a valid MP4 under current constraints.
     *
     * If multi-sample-description tracks are ever supported,
     * this normalization MUST be revisited.
     *
     */
    normalizeAccessUnitsInPlace({
        accessUnits: mp4CompilerState.semanticCore.accessUnits
    });


    // =====================================================================
    // Tier 2 — Structural Derivation (strategy + derivation)
    // =====================================================================

    deriveStructuralStateInPlace(mp4CompilerState);

    // =====================================================================
    // Tier 4 — Container Policies (declared early for adapter consumption)
    // =====================================================================

    const compressorNamePolicy =
        applyCompressorNamePolicy({
            compressorName:
            mp4CompilerState.buildHints?.compressorName
        });

    // =====================================================================
    // Tier 3 — Adaptation (semantic → emitter parameters)
    // =====================================================================

    // -- Time-to-sample
    const sttsParams = adaptSttsFromSamples({
        samples: mp4CompilerState.semanticCore.accessUnits
    });

    // -- Sample sizes
    const stszParams = adaptStszSizesFromPayloads({
        accessUnits: mp4CompilerState.semanticCore.accessUnits,
        accessUnitPayloads: mp4CompilerState.payloads.accessUnitPayloads
    });

    // -- Composition offsets
    const cttsParams = adaptCttsFromSamples({
        samples: mp4CompilerState.semanticCore.accessUnits
    });

    const hasNonZeroCompositionOffset =
        cttsParams.entries.some(e => e.offset !== 0);

    // -- Chunk mapping
    const stscParams =
        adaptStscEntriesToEmitterParams(mp4CompilerState.stscEntries);

    // -- Codec / sample description (raw, pre-policy)
    const rawStsdParams = adaptCodecConfigurationToStsdParams(
        {
            codec:          mp4CompilerState.semanticCore.codec.codec,
            compressorName: compressorNamePolicy,
            avcC:           mp4CompilerState.semanticCore.codec.avcC,
            width:          mp4CompilerState.buildParameters.codedWidth,
            height:         mp4CompilerState.buildParameters.codedHeight
        }
    );

    // =====================================================================
    // Tier 4 — Container Policies (explicit, named decisions)
    // =====================================================================


    let avcCProfileIndication;

    if (mp4CompilerState.semanticCore.codec.avcCCompleteness === "semantic") {
        avcCProfileIndication = rawStsdParams.avcC[1];
    }

    //
    // NOTE on codec-owned configuration boxes:
    //
    // avcC (video) MAY be container-completed via policy
    // esds (audio) MUST be treated as opaque
    //
    // esds contains a descriptor graph defined by ISO/IEC 14496-1.
    // Any mutation would require descriptor parsing and length recomputation,
    // which is outside container policy scope.
    //
    // Therefore:
    // - avcC may pass through applyAvcCContainerPolicy
    // - esds must be preserved byte-for-byte
    const stsdParams = {
        codec: rawStsdParams.codec,
        width: rawStsdParams.width,
        height: rawStsdParams.height,
        compressorName: rawStsdParams.compressorName,

        // Optional policy: btrt
        // - sourced ONLY from buildHints
        // - validated and passed through verbatim
        // - omitted if not supplied
        btrt: applyBtrtContainerPolicy({
            btrt: mp4CompilerState.buildHints?.btrt
        }),

        // Mandatory policy: AVC Container compatibility (High profile extension)
        avcC: applyAvcCContainerPolicy({
            avcC: rawStsdParams.avcC,
            avcCCompleteness: mp4CompilerState.semanticCore.codec.avcCCompleteness,
            profileIndication: avcCProfileIndication
        })
    };

    // =====================================================================
    // Tier 5 — Emission and Assembly
    // =====================================================================

    // ---------------------------------------------------------
    // MDAT (media payload)
    // ---------------------------------------------------------
    const {
        payload: mdatPayload,
        chunkOffsets
    } = assembleMdatPayloadFromChunks({
        accessUnitGroups: mp4CompilerState.chunks,
        accessUnitPayloads: mp4CompilerState.payloads.accessUnitPayloads
    });

    // ---------------------------------------------------------
    // Sample Table (stbl)
    // ---------------------------------------------------------
    const placeholderStco = emitStcoBox({
        chunkOffsets: new Array(mp4CompilerState.chunks.length).fill(0)
    });

    const stblChildren = {
        stsd: emitStsdBox(stsdParams),
        stts: emitSttsBox(sttsParams),
        stsc: emitStscBox(stscParams),
        stsz: emitStszBox(stszParams),
        stco: placeholderStco
    };

    if (mp4CompilerState.stssSampleNumbers.length > 0) {
        stblChildren.stss =
            emitStssBox({ sampleNumbers: mp4CompilerState.stssSampleNumbers });
    }

    if (hasNonZeroCompositionOffset) {
        stblChildren.ctts = emitCttsBox(cttsParams);
    }

    const stbl = emitStblBox(stblChildren);

    // ---------------------------------------------------------
    // Media boxes (mdia / minf)
    // ---------------------------------------------------------
    const dinf = emitDinfBox({
        dref: emitDrefBox()
    });

    const minf = emitMinfBox({
        vmhd: emitVmhdBox(),
        dinf,
        stbl
    });

    const mdhd = emitMdhdBox({
        timescale: mp4CompilerState.buildParameters.trackTimescale,
        duration: mp4CompilerState.trackDuration
    });

    const hdlr = emitHdlrBox(
        applyTrackHandlerPolicy({
            trackType: "video"
        })
    );

    const mdia = emitMdiaBox({
        mdhd,
        hdlr,
        minf
    });

    // ---------------------------------------------------------
    // Movie timing policy (container-level)
    // ---------------------------------------------------------
    const mvhdTiming = applyMovieTimingPolicy({
        trackDuration: mp4CompilerState.trackDuration,
        trackTimescale: mp4CompilerState.buildParameters.trackTimescale,
        trackId: 1,
        movieTimescale: mp4CompilerState.semanticHints?.movieTimescale
    });

    // ---------------------------------------------------------
    // Movie Header (mvhd)
    // ---------------------------------------------------------
    const mvhd = emitMvhdBox(mvhdTiming);

    // ---------------------------------------------------------
    // Track Header policy (container-level)
    // ---------------------------------------------------------
    const tkhdPolicy = applyTrackHeaderPolicy({
        mdhdTimescale: mp4CompilerState.buildParameters.trackTimescale,
        mdhdDuration:  mp4CompilerState.trackDuration,
        mvhdTimescale: mvhdTiming.timescale
    });

    const editListParams = applyEditListPolicy({
        trackDuration: mp4CompilerState.trackDuration,
        trackTimescale: mp4CompilerState.buildParameters.trackTimescale,
        movieTimescale: mvhdTiming.timescale,
        mediaStartTime: mp4CompilerState.semanticCore.accessUnits[0].pts
    });

    const edts = emitEdtsBox({
        elst: emitElstBox(editListParams.elst)
    });

    // ---------------------------------------------------------
    // Track and movie boxes
    // ---------------------------------------------------------

    // ---------------------------------------------------------
    // Track Header (tkhd)
    // ---------------------------------------------------------
    //
    // Track ID assignment
    // -------------------
    //
    // MP4 requires each track to have a positive integer track ID.
    // Under the current compiler constraints:
    //
    //   - exactly ONE track is supported
    //   - multi-track (e.g. audio) support is not yet implemented
    //   - no track ordering or numbering policy exists yet
    //
    // Therefore, the only valid and honest value is:
    //
    //   trackId = 1
    //
    // This is a CONTAINER-LEVEL decision, not a semantic media fact.
    //
    // When multi-track support is introduced, this value MUST be
    // replaced by an explicit Track ID Policy that assigns stable,
    // deterministic IDs across tracks.
    //

    // ---------------------------------------------------------
    // Track Header policy (container-level)
    // ---------------------------------------------------------
    const tkhd = emitTkhdBox({
        trackId: 1,
        duration: tkhdPolicy.duration,
        width: mp4CompilerState.buildParameters.codedWidth,
        height: mp4CompilerState.buildParameters.codedHeight,
        widthFraction: tkhdPolicy.widthFraction,
        heightFraction: tkhdPolicy.heightFraction
    });

    const trak = emitTrakBox({
        tkhd,
        edts,
        mdia
    });

    const udtaNode = applyUdtaPolicy({
        opaqueUdta: mp4CompilerState.buildHints?.udtaBytes,
        encoderIdentity: mp4CompilerState.buildHints?.encoderIdentity
    });

    // ---------------------------------------------------------
    // Movie Header (mvhd)
    // ---------------------------------------------------------
    //
    // nextTrackId assignment
    // ----------------------
    //
    // MP4 requires mvhd.next_track_ID to indicate the next
    // available track identifier.
    //
    // Under current constraints:
    //   - exactly ONE track is supported
    //   - that track is assigned trackId = 1
    //
    // Therefore, the only valid value is:
    //
    //   nextTrackId = 2
    //
    // This is a CONTAINER-LEVEL decision.
    // When multi-track support is added, this MUST be replaced
    // by an explicit Track ID allocation policy.
    //
    const moov = emitMoovBox({
        mvhd,
        traks: [trak],
        udta: udtaNode 
    });

    // DEBUG: inspect moov box structure before serialization
    console.log("=== DEBUG: moov box structure ===");
    console.log("moov.type:", moov.type);
    console.log(
        "moov.children:",
        moov.children.map(child => child.type)
    );

    const moovUdta = moov.children.find(child => child.type === "udta");

    if (!moovUdta) {
        console.log("DEBUG: moov has NO udta child");
    } else {
        console.log("DEBUG: moov.udta found");
        console.log("  udta.__opaque:", moovUdta.__opaque === true);
        console.log(
            "  udta.children:",
            Array.isArray(moovUdta.children)
            ? moovUdta.children.map(c => c.type)
            : moovUdta.children
        );
    }
    console.log("=== END DEBUG ===");

    // END DEBUG

    const ftyp = emitFtypBox({
        majorBrand: "isom",
        minorVersion: 512,
        compatibleBrands: ["isom", "iso2", "avc1", "mp41"]
    });

    // ---------------------------------------------------------
    // Physical layout + final file assembly
    // ---------------------------------------------------------
    const layout = resolvePhysicalLayout({
        ftypNode: ftyp,
        moovNode: moov,
        mdatPayload,
        chunkOffsets
    });

    const committedMoov = commitMoovWithResolvedLayout({
        originalMoovNode: moov,
        stcoOffsets: layout.stcoOffsets
    });

    return emitMp4FileFromResolvedParts({
        ftypNode: ftyp,
        committedMoovNode: committedMoov,
        mdatPayload,
        fileBoxOrder: layout.fileBoxOrder
    });
}
