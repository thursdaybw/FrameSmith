/**
 * Pre-Render Plan Fragments
 *
 * Purpose:
 * - Provide explicit constructors and constants for plan fragments.
 * - Prevent "stringly typed" fragment kinds from spreading.
 * - Keep planning and execution coupled only by a small, stable contract.
 *
 * Contract invariants:
 * - Planning produces fragments, not media frames, not audio samples.
 * - Access units appear only inside access-unit fragments.
 * - Fragment kinds are explicit, not ad-hoc strings.
 */

export const PreRenderPlanFragmentKinds = Object.freeze({
    ACCESS_UNITS: "access-units",
    PROCEDURAL: "procedural"
});

// Contributor kind identifies the origin of a plan fragment and determines
// how execution obtains time and data, not what the fragment contains or produces.
export const PreRenderPlanContributorKinds = Object.freeze({
    CONTAINER_TRACK: "container-track",
    PROCEDURAL: "procedural"
});

export function createAccessUnitPlanFragment({ access_units }) {
    if (!Array.isArray(access_units)) {
        throw new Error(
            "createAccessUnitPlanFragment: invalid access_units. " +
            `Expected array, got ${Object.prototype.toString.call(access_units)}`
        );
    }

    return {
        kind: PreRenderPlanFragmentKinds.ACCESS_UNITS,
        prerenderContributorKind:
        PreRenderPlanContributorKinds.CONTAINER_TRACK,
        access_units
    }
};



export function createProceduralPlanFragment({ kind, items }) {
    if (typeof kind !== "string" || kind.length === 0) {
        throw new Error(
            "createProceduralPlanFragment: invalid kind. " +
            `Expected non-empty string, got ${String(kind)}`
        );
    }

    if (!Array.isArray(items)) {
        throw new Error(
            "createProceduralPlanFragment: invalid items. " +
            `Expected array, got ${Object.prototype.toString.call(items)}`
        );
    }


    return {
        kind: PreRenderPlanFragmentKinds.PROCEDURAL,
        prerenderContributorKind:
        PreRenderPlanContributorKinds.PROCEDURAL,
        proceduralKind: kind,
        items
    };

}

export function isProceduralPlanFragment(fragment) {

    if (!fragment) return false;

    const isProceduralFragmentKind = fragment.kind === PreRenderPlanFragmentKinds.PROCEDURAL;
    const isProceduralContributor  = fragment.prerenderContributorKind === PreRenderPlanContributorKinds.PROCEDURAL;
    const hasProceduralKind        = typeof fragment.proceduralKind === "string";
    const hasItemsArray            = Array.isArray(fragment.items);

    return ( isProceduralFragmentKind && isProceduralContributor && hasProceduralKind && hasItemsArray);

}

