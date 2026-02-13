/**
 * routeProceduralFragmentAtTimeToResolver
 *
 * * Responsibility:
 * - Route a PROCEDURAL plan fragment to its registered timecode resolver
 * - Invoke that resolver with the provided time
 * - Return the resolver's declarative render intents
 *
 * This function does NOT:
 * - Perform timeline planning
 * - Decode media
 * - Compose or render pixels
 * - Allocate VideoFrame or AudioData
 * - Decide cross-fragment ordering
 *
 * Contract:
 * - Pure and deterministic for identical inputs
 * - Throws if no resolver is registered for fragment.proceduralKind
 */
export function routeProceduralFragmentAtTimeToResolver({
    fragment,
    timeSeconds,
    timecodeFragmentIntentResolvers
}) {
    if (!fragment || typeof fragment !== "object") {
        throw new Error("routeProceduralFragmentAtTimeToResolver: fragment required");
    }
    if (typeof timeSeconds !== "number") {
        throw new Error("routeProceduralFragmentAtTimeToResolver: timeSeconds must be a number");
    }

    if ( !timecodeFragmentIntentResolvers || typeof timecodeFragmentIntentResolvers !== "object") {
        throw new Error(
            "routeProceduralFragmentAtTimeToResolver: timecodeFragmentIntentResolvers required"
        );
    }

    const proceduralKind = fragment.proceduralKind;

    if (typeof proceduralKind !== "string" || proceduralKind.length === 0) {
        throw new Error(
            "routeProceduralFragmentAtTimeToResolver: fragment.proceduralKind required"
        );
    }

    const fragmentIntentAtTimeResolver = timecodeFragmentIntentResolvers[proceduralKind];

    if (typeof fragmentIntentAtTimeResolver !== "function") {
        throw new Error(
            `routeProceduralFragmentAtTimeToResolver: no timecode fragment intent resolver registered for proceduralKind=${proceduralKind}`
        );
    }

    const resolverOutput = fragmentIntentAtTimeResolver({ fragment, timeSeconds });

    if (!resolverOutput || typeof resolverOutput !== "object") {
        throw new Error(
            "routeProceduralFragmentAtTimeToResolver: resolver must return an object"
        );
    }

    const renderIntents = Array.isArray(resolverOutput.renderIntents)
        ? resolverOutput.renderIntents
        : [];

    return {
        timeSeconds,
        proceduralKind,
        renderIntents
    };
}
