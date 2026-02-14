import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { buildStsdAssemblyPlanFromParamsByCodec } from "../codecs/codecRegistry.js";

export function buildStsdIntentFromParams(stsdParams) {

    if (!stsdParams) {
        throw new Error(
            "buildStsdIntentFromTrack: stsdParams is required"
        );
    }

    const assemblyPlan = buildStsdAssemblyPlanFromParamsByCodec({
        stsdParams,
        callerLabel: "buildStsdIntentFromTrack"
    });

    const sampleEntryNode = EmitterRegistry.assemble(
        assemblyPlan.assemblyPath,
        assemblyPlan.assemblyInput
    );

    return {
       sampleEntries: [ sampleEntryNode ]
    };
}
