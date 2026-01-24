import { normalizeAccessUnitsInPlace } from "../normalization/access-units/index.js";
import { deriveStructuralStateInPlace } from "./deriveStructuralStateInPlace.js";
import { applyAvcCContainerPolicy } from "../policies/applyAvcCContainerPolicy.js";
import { applyBtrtContainerPolicy } from "../policies/applyBtrtContainerPolicy.js";
import { applyPaspContainerPolicy } from "../policies/applyPaspContainerPolicy.js";
import { applyTrackHandlerPolicy } from "../policies/applyTrackHandlerPolicy.js";
import { applyMovieTimingPolicy } from "../policies/applyMovieTimingPolicy.js";
import { applyEditListPolicy } from "../policies/applyEditListPolicy.js";
import { applyTrackHeaderPolicy } from "../policies/applyTrackHeaderPolicy.js";
import { applyCompressorNamePolicy } from "../policies/applyCompressorNamePolicy.js";
import { applyUdtaPolicy } from "../policies/applyUdtaPolicy.js";
import { adaptSttsFromSamples } from "../adapters/adaptSttsFromSamples.js";
import { adaptStszSizesFromPayloads } from "../adapters/adaptStszSizesFromPayloads.js";
import { adaptCttsFromSamples } from "../adapters/adaptCttsFromSamples.js";
import { adaptStscEntriesToEmitterParams } from "../adapters/adaptStscEntriesToEmitterParams.js";
import { adaptCodecConfigurationToStsdParams } from "../adapters/adaptCodecConfigurationToStsdParams.js";
import { adaptAudioCodecConfigurationToStsdParams } from "../adapters/adaptAudioCodecConfigurationToStsdParams.js";
import { assembleMdatPayloadFromChunks } from "../assembleMdatPayloadFromChunks.js";
import { resolvePhysicalLayout } from "../resolvePhysicalLayout.js";
import { commitMoovWithResolvedLayout } from "../commit/commitMoovWithResolvedLayout.js";
import { emitMp4FileFromResolvedParts } from "../emitMp4FileFromResolvedParts.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { parseAudioSpecificConfigFromEsds } from "../codec-introspection/mp4a/parseAudioSpecificConfigFromEsds.js";
import { deriveSyncSampleNumbers } from "../derivers/deriveSyncSampleNumbers.js";
import { applySyncRepresentationPolicy } from "../policies/applySyncRepresentationPolicy.js";

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { getGoldenTruthBox } from "../tests/goldenTruthExtractors/index.js";

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
    for (const track of mp4CompilerState.tracks) {

        track.semanticTrackFamily = deriveSemanticTrackFamily(track);
        track.trackDuration = getSumOfAccessUnitDurations(track.semanticCore.accessUnits);
        mp4CompilerState.highestTrackId = 1;

        normalizeAccessUnitsInPlace({
            accessUnits: track.semanticCore.accessUnits,
            codec: track.semanticCore.codec.codec,
            trackDuration: track.trackDuration
        });

    }

    // =====================================================================
    // Tier 2 — Structural Derivation (strategy + derivation)
    // =====================================================================
    deriveStructuralStateInPlace(mp4CompilerState);

    // ---------------------------------------------------------
    // Derive sync sample numbers (semantic fact)
    // ---------------------------------------------------------
    for (const track of mp4CompilerState.tracks) {
        track.derivedSyncSampleNumbers = deriveSyncSampleNumbers({ samples: track.semanticCore.accessUnits });
    }

    // =====================================================================
    // Tier 4 — Container Policies (declared early for adapter consumption)
    // =====================================================================
    const compressorNamePolicy = applyCompressorNamePolicy({
            compressorName:
            mp4CompilerState.buildHints?.compressorName
        });

    /**
     * buildHints: {
     *     sttsPolicy: "canonical" | "oracle-faithful"
     * }
     */
    const sttsPolicy = mp4CompilerState.buildHints?.sttsPolicy ?? "canonical";

    // =====================================================================
    // Tier 3 — Adaptation (semantic → emitter parameters)
    // =====================================================================
    for (const track of mp4CompilerState.tracks) {

        // -- Time-to-sample
        track.sttsParams = adaptSttsFromSamples({
            samples: track.semanticCore.accessUnits,
            sttsPolicy
        });


        // -- Sample sizes
        track.stszParams = adaptStszSizesFromPayloads({
            accessUnits: track.semanticCore.accessUnits,
            accessUnitPayloads: track.payloads.accessUnitPayloads
        });

        // -- Composition offsets
        track.cttsParams = adaptCttsFromSamples({
            samples: track.semanticCore.accessUnits
        });

        track.hasNonZeroCompositionOffset = track.cttsParams.entries.some(e => e.offset !== 0);

        // -- Chunk mapping
        
        track.stscParams = adaptStscEntriesToEmitterParams(track.stscEntries);

        // -- Sample description (codec-family dispatch)
        if (track.semanticCore.codec.codec.startsWith("avc1")) {

            track.rawStsdParams = adaptCodecConfigurationToStsdParams({
                    codec:          track.semanticCore.codec.codec,
                    compressorName: compressorNamePolicy,
                    avcC:           track.semanticCore.codec.avcC,
                    width:          track.buildParameters.codedWidth,
                    height:         track.buildParameters.codedHeight
                });


        } else if (track.semanticCore.codec.codec === "opus") {

            const {
                channelCount,
                sampleRate
            } = track.buildParameters;

            if (!Number.isInteger(channelCount) ||
                !Number.isInteger(sampleRate)) {
                throw new Error(
                    "compileMp4: opus buildParameters must supply channelCount and sampleRate"
                );
            }


            track.rawStsdParams = {
                codec: "mp4a",
                esds: track.semanticCore.codec.esds,
                channelCount,
                sampleRate
            };

        } else if (track.semanticCore.codec.codec.startsWith("mp4a")) {

            // ---------------------------------------------------------
            // Audio shape resolution (semantic-first, container-fallback)
            // ---------------------------------------------------------

            let channelCount;
            let sampleRate;

            // Primary source: AudioSpecificConfig (if present)
            const asc =
                parseAudioSpecificConfigFromEsds({
                    esds: track.semanticCore.codec.esds
                });

            if (asc !== null) {

                const {
                    samplingFrequencyIndex,
                    channelConfiguration
                } = asc;

                const samplingFrequencyTable = [
                    96000, 88200, 64000, 48000,
                    44100, 32000, 24000, 22050,
                    16000, 12000, 11025, 8000,
                    7350
                ];

                sampleRate =
                    samplingFrequencyTable[samplingFrequencyIndex];

                channelCount =
                    channelConfiguration;

            } else {

                // Fallback: buildParameters (oracle + WebCodecs symmetry)
                channelCount =
                    track.buildParameters.channelCount;

                sampleRate =
                    track.buildParameters.sampleRate;

            }

            if (!Number.isInteger(channelCount) ||
                !Number.isInteger(sampleRate)) {
                throw new Error(
                    "compileMp4: unable to resolve audio channelCount/sampleRate"
                );
            }


            track.rawStsdParams = {
                codec: "mp4a",
                esds: track.semanticCore.codec.esds,
                channelCount,
                sampleRate
                // sampleSize is NOT semantic and is intentionally omitted here
            };

        }

        else {
            throw new Error(
                `Unsupported codec for stsd adaptation: ${track.semanticCore.codec.codec}`
            );
        }

    }

    // =====================================================================
    // Tier 4 — Container Policies (explicit, named decisions)
    // =====================================================================

    for (const track of mp4CompilerState.tracks) {

        const rawStsdParams = track.rawStsdParams;

        // ---------------------------------------------------------
        // Sync sample representation policy (stss vs none)
        // ---------------------------------------------------------
        if (track.semanticTrackFamily == 'video') console.log('Derived sync sample numbers', track.derivedSyncSampleNumbers.sampleNumbers);
        track.syncRepresentation = applySyncRepresentationPolicy({
                derivedSyncSampleNumbers: track.derivedSyncSampleNumbers,
                buildHints: track.buildHints
            });

        if (track.semanticTrackFamily == 'video') console.log('track.syncRepresentation', track.syncRepresentation);

        if (rawStsdParams.codec === "avc1") {

            let avcCProfileIndication;

            if (track.semanticCore.codec.avcCCompleteness === "semantic") {
                avcCProfileIndication = rawStsdParams.avcC[1];
            }

            // avcC (video) MAY be container-completed via policy
            // Therefore:
            // - avcC may pass through applyAvcCContainerPolicy
            track.stsdParams = {
                codec: rawStsdParams.codec,
                width: rawStsdParams.width,
                height: rawStsdParams.height,
                compressorName: rawStsdParams.compressorName,

                // Optional container compatibility boxes
                pasp: applyPaspContainerPolicy({
                    pasp: track.buildHints?.pasp
                }),

                // Optional policy: btrt
                // - sourced ONLY from buildHints
                // - validated and passed through verbatim
                // - omitted if not supplied
                btrt: applyBtrtContainerPolicy({
                    btrt: track.buildHints?.btrt
                }),

                // Mandatory policy: AVC Container compatibility (High profile extension)
                avcC: applyAvcCContainerPolicy({
                    avcC: rawStsdParams.avcC,
                    avcCCompleteness:
                    track.semanticCore.codec.avcCCompleteness,
                    profileIndication: avcCProfileIndication
                })
            };

        } else if (rawStsdParams.codec === "mp4a") {

            track.stsdParams = {
                codec: rawStsdParams.codec,

                // Container-level defaults for mp4a SampleEntry
                // These are NOT semantic and are NOT derivable from WebCodecs
                channelCount: rawStsdParams.channelCount,
                sampleRate:   rawStsdParams.sampleRate,
                sampleSize:   16, // MP4 container default (explicit policy)

                // Opaque codec configuration (must remain byte-for-byte)
                esds: rawStsdParams.esds,

                // Optional policy: btrt
                // - sourced ONLY from buildHints
                // - validated and passed through verbatim
                // - omitted if not supplied
                btrt: applyBtrtContainerPolicy({
                    btrt: track.buildHints?.btrt
                }),

            };

        } else if (rawStsdParams.codec === "opus") {

            // ---------------------------------------------------------
            // Opus (WebCodecs) → mp4a SampleEntry adaptation
            // ---------------------------------------------------------
            //
            // WebCodecs exposes Opus as a codec string, but MP4
            // container representation uses an mp4a SampleEntry
            // with opaque ESDS payload.
            //
            // This is a REPRESENTATIONAL adaptation, not a semantic one.
            //

            track.stsdParams = {
                codec: "mp4a",

                // Container-level defaults (explicit policy)
                channelCount: rawStsdParams.channelCount,
                sampleRate:   rawStsdParams.sampleRate,
                sampleSize:   16,

                // Opaque codec configuration (verbatim from WebCodecs)
                esds: rawStsdParams.esds
            };
        } else {
            throw new Error(
                `Unsupported codec in Tier 4: ${rawStsdParams.codec}`
            );
        }
    }

    // ---------------------------------------------------------
    // Movie timing policy (container-level)
    // ---------------------------------------------------------
    const movieDuration = getDurationOfLongestTrack(mp4CompilerState.tracks);

    // Just choose an arbitrary track to supply the timescale, whichever doesn't matter.
    const trackTimescale = mp4CompilerState.tracks[0].buildParameters.trackTimescale;

    const mvhdTiming = applyMovieTimingPolicy({
        movieDurationInTrackTimescale: movieDuration, 
        trackTimescale, 
        trackId: mp4CompilerState.highestTrackId,
        movieTimescale: mp4CompilerState.semanticHints?.movieTimescale
    });

    // ---------------------------------------------------------
    // Movie Header (mvhd)
    // ---------------------------------------------------------
    const mvhdIntent = {
        timescale:   mvhdTiming.timescale,
        duration:    mvhdTiming.duration,
        nextTrackId: mvhdTiming.nextTrackId
    };

    // =====================================================================
    // Tier 5 — Emission and Assembly
    // =====================================================================

    // ---------------------------------------------------------
    // MDAT (media payload) — per-track assembly
    // ---------------------------------------------------------

    const trackMdatParts = [];

    for (const track of mp4CompilerState.tracks) {

        const {
            payload,
            chunkOffsets
        } = assembleMdatPayloadFromChunks({
            accessUnitGroups: track.chunks,
            accessUnitPayloads: track.payloads.accessUnitPayloads
        });

        track.chunkOffsets = chunkOffsets;

        trackMdatParts.push({
            payload,
            chunkOffsets,
            track
        });
    }

    // ---------------------------------------------------------
    // MDAT (container-level concatenation)
    // ---------------------------------------------------------

    const mdatPayload = concatUint8Arrays(
        trackMdatParts.map(p => p.payload)
    );

    // ---------------------------------------------------------
    // Sample Tables (stbl) — per track
    // ---------------------------------------------------------

    for (const part of trackMdatParts) {
        part.track.stblIntent = buildStblIntentFromTrack(part.track);
    }

    // ---------------------------------------------------------
    // Media boxes (mdia / minf / trak) — per track
    // ---------------------------------------------------------

    const traks = [];
    for (let i = 0; i < mp4CompilerState.tracks.length; i++) {

        const track = mp4CompilerState.tracks[i];

        const dinfIntent = {
            dref: {}
        };

        const minfIntent = {
            mediaHeader: {
                type: track.semanticTrackFamily === "audio" ? "smhd" : "vmhd"
            },
            dinf: dinfIntent,
            stbl: track.stblIntent
        };

        const mdhdIntent = {
            timescale: track.buildParameters.trackTimescale,
            duration:  track.trackDuration
        };

        let handlerType;

        if (track.semanticTrackFamily === "audio") {
            handlerType = "soun";
        } else {
            handlerType = "vide";
        }

        const mdiaIntent = {
            mdhd: mdhdIntent,

            hdlr: {
                handlerType,
                nameBytes: resolveHdlrNameBytes(
                    track.semanticHints?.hdlr,
                    track.semanticTrackFamily
                )
            },

            minf: minfIntent
        };

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
       
        track.trakIntent = {
            tkhd: {
                trackId: mp4CompilerState.highestTrackId,
                mdhdTimescale: track.buildParameters.trackTimescale,
                mdhdDuration:  track.trackDuration,
                width:
                track.semanticTrackFamily === "video"
                ? track.buildParameters.codedWidth
                : 0,

                height:
                track.semanticTrackFamily === "video"
                ? track.buildParameters.codedHeight
                : 0
            },

            edts: {
                elst: null
            },

            mdia: mdiaIntent
        };
        mp4CompilerState.highestTrackId++;

        traks.push(track.trakIntent);
    }

    let udtaIntent = null;

    if (mp4CompilerState.buildHints?.udta !== undefined) {

        // Structured udta already supplied — trust it verbatim
        udtaIntent = mp4CompilerState.buildHints.udta;

    } else {

        // Otherwise, derive udta via policy
        udtaIntent = applyUdtaPolicy({
            opaqueUdta: mp4CompilerState.buildHints?.udtaBytes,
            encoderIdentity: mp4CompilerState.buildHints?.encoderIdentity
        });

    }

    // ---------------------------------------------------------
    // Track Header Policy (moov-scoped, TEMPORARY PLACEMENT)
    // ---------------------------------------------------------
    //
    // NOTE:
    // This policy depends on mvhdTimescale and mdhd-derived values.
    // It belongs at the moov boundary.
    //
    // The moov assembler is not yet registry-driven, so this
    // policy is applied here as a staging step.
    // This MUST move when emitMoovBox is replaced by
    // EmitterRegistry.assemble("moov", ...)
    //

    for (const trak of traks) {

        const tkhd = trak.tkhd;
        const mdhd = trak.mdia?.mdhd;

        if (!tkhd || !mdhd) {
            throw new Error(
                "compileMp4: tkhd/mdhd required before applyTrackHeaderPolicy"
            );
        }

        const headerPolicy =
            applyTrackHeaderPolicy({
                mdhdTimescale: mdhd.timescale,
                mdhdDuration:  mdhd.duration,
                mvhdTimescale: mvhdTiming.timescale
            });

        Object.assign(tkhd, headerPolicy);
    }

    // ---------------------------------------------------------
    // Edit List Policy (moov-scoped, TEMPORARY PLACEMENT)
    // ---------------------------------------------------------
    //
    // NOTE:
    // Edit lists map TRACK time → MOVIE time.
    // Therefore this policy MUST run after applyMovieTimingPolicy
    // and after mvhd.timescale is authoritative.
    //

    for (const trak of traks) {

        const mdhd = trak.mdia?.mdhd;
        const edts = trak.edts;

        if (!mdhd || !edts) {
            throw new Error(
                "compileMp4: mdhd/edts required before applyEditListPolicy"
            );
        }

        const editList =
            applyEditListPolicy({
                trackDuration: mdhd.duration,
                trackTimescale: mdhd.timescale,
                movieTimescale: mvhdIntent.timescale,
                mediaStartTime:
                trak.mdia.minf.stbl.stts
                ? trak.mdia.minf.stbl.stts.entries[0].sampleDelta
                : trak.mdia.mdhd.duration === 0
                ? 0
                : trak.mdia.mdhd.duration // defensive fallback
            });

        edts.elst = editList.elst;
    }

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
    const moov = EmitterRegistry.assemble(
        "moov",
        {
            mvhd: mvhdIntent,
            traks,
            // IMPORTANT:
            // only pass udta through assembler if it is semantic
            udta:
            udtaIntent && udtaIntent.children
            ? udtaIntent
            : null
        }
    );

    // ---------------------------------------------------------
    // Inline opaque udta passthrough (compiler responsibility)
    // ---------------------------------------------------------
    if (udtaIntent && udtaIntent.bytes instanceof Uint8Array) {

        // Remove any assembler-emitted udta (defensive)
        moov.children = moov.children.filter(
            child => child.type !== "udta"
        );

        // Inject opaque udta verbatim
        moov.children.push({
            type: "udta",
            bytes: udtaIntent.bytes
        });
    }


    const ftyp = EmitterRegistry.emit(
        "ftyp",
        {
            majorBrand: "isom",
            minorVersion: 512,
            compatibleBrands: ["isom", "iso2", "avc1", "mp41"]
        }
    );

    // ---------------------------------------------------------
    // Resolve MDAT-relative chunk offsets (layout-aware)
    // ---------------------------------------------------------

    const allChunkOffsets = [];

    let mdatPayloadCursor = 0;

    for (const part of trackMdatParts) {

        // part.chunkOffsets are relative to the start of this track's payload
        for (const localOffset of part.chunkOffsets) {
            allChunkOffsets.push(mdatPayloadCursor + localOffset);
        }

        // Advance cursor by this track's physical payload size
        mdatPayloadCursor += part.payload.length;
    }

    const moovBytesPreLayout = serializeBoxTree(moov);

    const stscBoxReport =  
        getGoldenTruthBox
        .getSemanticBoxDataFromBox({
            boxBytes: moovBytesPreLayout,
            sourceRegistryKey: "moov",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stsc"
        })
        .readBoxReport()

    // ---------------------------------------------------------
    // Physical layout + final file assembly
    // ---------------------------------------------------------
    const layout = resolvePhysicalLayout({
        ftypNode: ftyp,
        moovNode: moov,
        mdatPayload,

        chunkOffsets: allChunkOffsets
    });

    const perTrackStcoOffsets = [];

    let cursor = 0;

    for (const part of trackMdatParts) {

        const chunkCount = part.chunkOffsets.length;

        const resolvedOffsets = layout.stcoOffsets.slice(cursor, cursor + chunkCount);

        if (resolvedOffsets.length !== chunkCount) {
            throw new Error("compileMp4: STCO slice mismatch");
        }

        perTrackStcoOffsets.push({
            track: part.track,
            stcoOffsets: resolvedOffsets
        });

        cursor += chunkCount;
    }

    const committedMoov = commitMoovWithResolvedLayout({
        originalMoovNode: moov,
        perTrackStcoOffsets
    });

    const bytes = emitMp4FileFromResolvedParts({
        ftypNode: ftyp,
        committedMoovNode: committedMoov,
        mdatPayload,
        fileBoxOrder: layout.fileBoxOrder
    });

    const finalizedStscBoxReport =  
        getGoldenTruthBox
        .getSemanticBoxDataFromBox({
            boxBytes: bytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stsc"
        })
        .readBoxReport()

    return {
        bytes: bytes,
        __debug: {
            committedMoovIntent: committedMoov
        }
    };

}

function concatUint8Arrays(arrays) {

    let totalLength = 0;

    for (const arr of arrays) {
        totalLength += arr.length;
    }

    const out = new Uint8Array(totalLength);

    let offset = 0;
    for (const arr of arrays) {
        out.set(arr, offset);
        offset += arr.length;
    }

    return out;
}

function buildStblIntentFromTrack(track) {

    let sampleEntryNode;

    // ---------------------------------------------------------
    // Sample Entry routing (codec-family dispatch)
    // ---------------------------------------------------------
    if (track.stsdParams.codec === "avc1") {

        const { codec, ...avc1Params } = track.stsdParams;

        sampleEntryNode = EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd|avc1",
            avc1Params
        );

    } else if (track.stsdParams.codec === "mp4a") {

        const { codec, ...mp4aParams } = track.stsdParams;

        sampleEntryNode = EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd|mp4a",
            mp4aParams
        );

    } else {
        throw new Error(
            `Unsupported codec for STSD sample entry: ${track.stsdParams.codec}`
        );
    }

    // ---------------------------------------------------------
    // Canonical STBL intent
    // ---------------------------------------------------------
    const stblIntent = {
        stsd: {
            sampleEntries: [ sampleEntryNode ]
        },
        stts: track.sttsParams,
        stsc: track.stscParams,
        stsz: track.stszParams,
        stco: {
            chunkOffsets: new Array(track.chunks.length).fill(0)
        },
    };

    console.log(
        "[buildStblIntentFromTrack] base STBL intent",
        {
            hasStts: !!stblIntent.stts,
            hasStsc: !!stblIntent.stsc,
            hasStsz: !!stblIntent.stsz
        }
    );

    if ( track.hasNonZeroCompositionOffset) {
        stblIntent.ctts = track.cttsParams;
    }

    // ---------------------------------------------------------
    // Sync sample representation (policy-decided)
    // ---------------------------------------------------------
    if (track.syncRepresentation) {

        if (track.syncRepresentation.kind === "stss") {

            console.log(
                "[buildStblIntentFromTrack] adding STSS",
                {
                    count: track.syncRepresentation.sampleNumbers.length
                }
            );

            stblIntent.stss = {
                sampleNumbers: track.syncRepresentation.sampleNumbers
            };
        }

        else if (track.syncRepresentation.kind === "sgpd/sbgp") {
            
            stblIntent.sgpd =  track.syncRepresentation.sgpdData;
            stblIntent.sbgp =  track.syncRepresentation.sbgpData;

        }

        // kind === "none" → emit nothing
    }

    console.log(
        "[buildStblIntentFromTrack] final STBL keys",
        Object.keys(stblIntent)
    );

    return stblIntent;

}

function deriveSemanticTrackFamily(track) {

    const codec = track.semanticCore.codec.codec;

    if (codec.startsWith("mp4a") || codec === "opus") {
        return "audio";
    }

    return "video";
}

export function getSumOfAccessUnitDurations(accessUnits) {

        if (!accessUnits) {
            throw new Error( "deriveTrackDurations: accessUnits is required");
        }
        if (!Array.isArray(accessUnits)) {
            throw new Error( "deriveTrackDurations: accessUnits must be an array");
        }

        if (accessUnits.length === 0) {
            return 0;
        }

        let totalDuration = 0;

        for (const accessUnit of accessUnits) {

            if (!Number.isInteger(accessUnit.duration)) {
                throw new Error("deriveTrackDurations: accessUnit.duration must be an integer");
            }

            totalDuration += accessUnit.duration;
        }

        return totalDuration;
}

function getDurationOfLongestTrack(tracks) {

    if (!Array.isArray(tracks)) {
        throw new Error("deriveMovieDurationFromTracks: tracks must be an array");
    }

    if (tracks.length === 0) {
        return 0;
    }

    let maximumDuration = 0;

    for (const track of tracks) {

        if (!Number.isInteger(track.trackDuration)) {
            throw new Error(
                "deriveMovieDurationFromTracks: track.trackDuration must be an integer"
            );
        }

        if (track.trackDuration > maximumDuration) {
            maximumDuration = track.trackDuration;
        }
    }

    return maximumDuration;
}

function resolveHdlrNameBytes(hdlrIntent, trackFamily) {

    if (hdlrIntent && hdlrIntent.nameBytes instanceof Uint8Array) {
        return hdlrIntent.nameBytes;
    }

    if (hdlrIntent && typeof hdlrIntent.name === "string") {
        return new TextEncoder().encode(hdlrIntent.name + "\0");
    }

    if (trackFamily === "audio") {
        return new TextEncoder().encode("SoundHandler\0");
    }

    return new TextEncoder().encode("VideoHandler\0");
}
