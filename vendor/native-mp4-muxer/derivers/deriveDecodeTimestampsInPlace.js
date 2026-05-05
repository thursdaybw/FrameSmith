/**
 * deriveDecodeTimestampsInPlace
 * =============================
 *
 * Compiler-owned structural derivation.
 *
 * Assigns decode timestamps (DTS) to access units that do not
 * already have them.
 *
 * Current strategy (v1):
 * ----------------------
 * Decode order == presentation order.
 *
 * That is:
 *   dts = pts
 *
 * This strategy:
 *   - is deterministic
 *   - produces integer DTS values
 *   - guarantees DTS <= PTS (CTTS v0 compatible)
 *   - produces monotonic non-decreasing DTS
 *
 * This function:
 *   - mutates accessUnits in place
 *   - does NOT read source hints
 *   - does NOT depend on container structure
 *
 * If future strategies are introduced, they must:
 *   - preserve these invariants, or
 *   - explicitly upgrade CTTS version support
 */
export function deriveDecodeTimestampsInPlace({ accessUnits }) {

    if (!Array.isArray(accessUnits)) {
        throw new Error(
            "deriveDecodeTimestampsInPlace: expected accessUnits array"
        );
    }

    if (accessUnits.length === 0) {
        return;
    }

    let currentDts = 0;

    for (let i = 0; i < accessUnits.length; i++) {
        const unit = accessUnits[i];

        if (!Number.isInteger(unit.pts)) {
            throw new Error(
                `deriveDecodeTimestampsInPlace: accessUnits[${i}].pts must be an integer`
            );
        }

        if (!Number.isInteger(unit.duration)) {
            throw new Error(
                `deriveDecodeTimestampsInPlace: accessUnits[${i}].duration is required before DTS derivation`
            );
        }

        unit.dts = currentDts;
        currentDts += unit.duration;
    }
}
