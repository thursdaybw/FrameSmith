import { resolveProceduralFragmentsAtTimeFromPlan } from "./resolveProceduralFragmentsAtTimeFromPlan.js";

import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../../vendor/media-timeline-compiler/planFragments.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export function test_resolveProceduralFragmentsAtTimeFromPlan_collectsProceduralRenderIntents() {

    const proceduralFragment = {
        kind: PreRenderPlanFragmentKinds.PROCEDURAL,
        prerenderContributorKind:
            PreRenderPlanContributorKinds.PROCEDURAL,
        proceduralKind: "text-overlay",
        items: []
    };

    const plan = {
        fragments: [ proceduralFragment ]
    };

    const resolvers = {
        "text-overlay": () => ({
            renderIntents: [{ kind: "text-overlay" }]
        })
    };

    const result = resolveProceduralFragmentsAtTimeFromPlan({
        plan,
        timeSeconds: 5,
        timecodeFragmentIntentResolvers: resolvers
    });

    assert(
        Array.isArray(result.renderIntents),
        "renderIntents must be array"
    );

    assert(
        result.renderIntents.length === 1,
        "must collect renderIntents from procedural fragments"
    );

}

export const PRERENDER_TIME_RESOLUTION_TESTS = [
    test_resolveProceduralFragmentsAtTimeFromPlan_collectsProceduralRenderIntents
];
