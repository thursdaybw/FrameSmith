import { EMITTER_REGISTRY_VALIDATION_CASES } from "./EMITTER_REGISTRY_VALIDATION_CASES.js";
import { runEmitterRegistryValidationCase } from "./runEmitterRegistryValidationCase.js";

export function test_EmitterRegistry_ValidationMatrix() {

    for (const testCase of EMITTER_REGISTRY_VALIDATION_CASES) {
        runEmitterRegistryValidationCase(testCase);
    }
}
