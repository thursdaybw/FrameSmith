import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";



export function runEmitterRegistryValidationCase(testCase) {

    const {
        id,
        api,
        path,
        node,
        expect
    } = testCase;

    let threw = false;
    let error = null;

    try {
        switch (api) {


            case "emit": {
                const original = EmitterRegistry._emitters[path];

                try {
                    if (node !== undefined && path) {
                        EmitterRegistry._emitters[path] = () => node;
                    }

                    EmitterRegistry.emit(path, {});
                } finally {
                    if (node !== undefined && path) {
                        if (original) {
                            EmitterRegistry._emitters[path] = original;
                        } else {
                            delete EmitterRegistry._emitters[path];
                        }
                    }
                }
                break;
            }

            case "assemble": {
                const original = EmitterRegistry._assemblers[path];

                try {
                    if (node !== undefined && path) {
                        EmitterRegistry._assemblers[path] = () => node;
                    }

                    EmitterRegistry.assemble(path, {});
                } finally {
                    if (node !== undefined && path) {
                        if (original) {
                            EmitterRegistry._assemblers[path] = original;
                        } else {
                            delete EmitterRegistry._assemblers[path];
                        }
                    }
                }
                break;
            }

            default:
                throw new Error(`Unknown api '${api}' in case '${id}'`);
        }

    } catch (e) {
        threw = true;
        error = e;
    }

    if (expect === "throw" && !threw) {
        throw new Error(`Validation case '${id}' did not throw`);
    }

    if (expect === "pass" && threw) {
        throw new Error(
            `Validation case '${id}' threw unexpectedly:\n${error.message}`
        );
    }

    return true;
}
