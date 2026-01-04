/**
 * sbgp — Sample To Group Box
 * =========================
 *
 * Domain
 * ------
 * MP4 *sample grouping metadata*
 *
 * The `sbgp` box belongs to a small family of MP4 boxes whose sole purpose
 * is to describe **relationships between samples**, not samples themselves.
 *
 * It does NOT:
 * - store media data
 * - affect decoding
 * - affect timing
 * - affect chunk layout
 *
 * Instead, `sbgp` declares *how samples are classified* for some higher-level
 * purpose defined elsewhere.
 *
 * ---------------------------------------------------------------------------
 * What problem does `sbgp` solve?
 * ---------------------------------------------------------------------------
 *
 * MP4 samples are a flat sequence:
 *
 *   sample 1, sample 2, sample 3, ...
 *
 * But real-world workflows often need to express *logical groupings* across
 * that sequence:
 *
 *   - samples that use a particular trick mode
 *   - samples that share a roll recovery behavior
 *   - samples that participate in switching, redundancy, or alternates
 *
 * `sbgp` answers the question:
 *
 *   “For each run of samples, which *group description* applies?”
 *
 * It does this without knowing:
 *   - what the grouping means
 *   - how it will be used
 *   - whether the player cares
 *
 * It is a *pure declarative mapping*.
 *
 * ---------------------------------------------------------------------------
 * How `sbgp` works (conceptually)
 * ---------------------------------------------------------------------------
 *
 * `sbgp` contains:
 *
 *   1. a `grouping_type` (FourCC)
 *   2. a list of entries:
 *
 *        sample_count
 *        group_description_index
 *
 * Read as:
 *
 *   “For the next N samples, use group description X”
 *
 * The interpretation of `group_description_index` is defined entirely by
 * a corresponding `sgpd` (Sample Group Description) box with the same
 * `grouping_type`.
 *
 * `sbgp` does NOT embed the description itself.
 *
 * This indirection is deliberate.
 *
 * ---------------------------------------------------------------------------
 * Relationship to `sgpd`
 * ---------------------------------------------------------------------------
 *
 * `sbgp` and `sgpd` are a matched pair:
 *
 *   - `sbgp` answers **where** a group applies
 *   - `sgpd` answers **what** the group means
 *
 * They are linked only by:
 *
 *   - shared `grouping_type`
 *   - numeric indices
 *
 * MP4 does NOT require:
 *   - that a player understands the grouping
 *   - that `sbgp` and `sgpd` even exist
 *
 * Unknown groupings are legal and expected.
 *
 * This makes sample grouping:
 *   - forward-compatible
 *   - extensible
 *   - safe to ignore
 *
 * ---------------------------------------------------------------------------
 * Historical context
 * ---------------------------------------------------------------------------
 *
 * Sample grouping was introduced to allow MP4 to grow without exploding the
 * number of hard-coded box types.
 *
 * Instead of inventing a new box every time a new playback behavior was needed,
 * MP4 introduced:
 *
 *   - generic grouping (`sbgp`)
 *   - generic descriptions (`sgpd`)
 *
 * This design mirrors other extensibility patterns in MP4:
 *   - handler types
 *   - codec configuration boxes
 *   - brand signaling
 *
 * The container stays stable.
 * Semantics evolve externally.
 *
 * ---------------------------------------------------------------------------
 * NativeMuxer’s policy for `sbgp`
 * ---------------------------------------------------------------------------
 *
 * NativeMuxer treats `sbgp` as **opaque-or-declared container metadata**.
 *
 * This emitter:
 * - validates structural correctness only
 * - serializes fields in spec-defined order
 * - preserves declared values exactly
 *
 * This emitter explicitly does NOT:
 * - infer grouping semantics
 * - derive entries from samples
 * - coordinate with `sgpd`
 * - validate cross-box consistency
 *
 * All of those concerns live at higher architectural tiers.
 *
 * ---------------------------------------------------------------------------
 * Why entries are emitted as flat fields
 * ---------------------------------------------------------------------------
 *
 * `sbgp` entries are NOT nested boxes.
 * They are repeated scalar field pairs defined by the spec.
 *
 * This emitter therefore emits:
 *
 *   [ sample_count, group_description_index, ... ]
 *
 * directly into the box body, without introducing artificial structure.
 *
 * This keeps:
 * - the emitted layout honest
 * - structure tests simple
 * - byte-level equivalence exact
 *
 * ---------------------------------------------------------------------------
 * Architectural role of this emitter
 * ---------------------------------------------------------------------------
 *
 * This function is a **pure serializer**:
 *
 *   semantic intent → MP4 container structure
 *
 * It is intentionally boring.
 *
 * If this function ever needs to make a decision, the design is wrong.
 *
 * Decisions belong in:
 *   - normalization
 *   - derivation
 *   - adaptation
 *   - container policy
 *
 * Not here.
 */
export function emitSbgpBox({
    groupingType,
    entries
}) {
    // -------------------------------------------------------------
    // Defensive validation (structure only)
    // -------------------------------------------------------------
    if (
        typeof groupingType !== "string" ||
        groupingType.length !== 4
    ) {
        throw new Error(
            "emitSbgpBox: groupingType must be a 4-character string"
        );
    }

    if (!Array.isArray(entries)) {
        throw new Error(
            "emitSbgpBox: entries must be an array"
        );
    }

    for (const entry of entries) {
        if (
            !Number.isInteger(entry.sampleCount) ||
            entry.sampleCount < 0
        ) {
            throw new Error(
                "emitSbgpBox: entry.sampleCount must be a non-negative integer"
            );
        }

        if (
            !Number.isInteger(entry.groupDescriptionIndex) ||
            entry.groupDescriptionIndex < 0
        ) {
            throw new Error(
                "emitSbgpBox: entry.groupDescriptionIndex must be a non-negative integer"
            );
        }
    }

    // -------------------------------------------------------------
    // Build body explicitly (no spread, no flatMap)
    // -------------------------------------------------------------
    const body = [];

    // grouping_type (4cc)
    body.push({ type: groupingType });

    // entry_count
    body.push({ int: entries.length });

    // entries (repeated field pairs)
    for (const entry of entries) {
        body.push({ int: entry.sampleCount });
        body.push({ int: entry.groupDescriptionIndex });
    }

    // -------------------------------------------------------------
    // Emit FullBox
    // -------------------------------------------------------------
    return {
        type: "sbgp",
        version: 1,
        flags: 0,
        body
    };
}
