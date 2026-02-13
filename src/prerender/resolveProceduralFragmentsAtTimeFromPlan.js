import { routeProceduralFragmentAtTimeToResolver } from "../timeline/procedural/routeProceduralFragmentAtTimeToResolver.js";

export function resolveProceduralFragmentsAtTimeFromPlan({ plan, timeSeconds, timecodeFragmentIntentResolvers }) {

    const renderIntents = [];

    for (const fragment of plan.fragments) {

        if (fragment.prerenderContributorKind !== "procedural") {
            continue;
        }

        const result = routeProceduralFragmentAtTimeToResolver({
            fragment,
            timeSeconds,
            timecodeFragmentIntentResolvers
        });

        if (Array.isArray(result.renderIntents)) {
            renderIntents.push(...result.renderIntents);
        }
    }

    return { renderIntents };
}
