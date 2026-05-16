import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * ASSEMBLER CONTRACT
 * ==================
 *
 * This function accepts SEMANTIC INTENT ONLY.
 *
 * It MUST NOT receive:
 * - serialized box bytes
 * - box headers
 * - emitter nodes
 *
 * It MUST:
 * - validate intent types and ranges
 * - construct child boxes via EmitterRegistry
 * - delegate container construction via emitContainer
 */
function assembleUdta(intent, { emitContainer }) {

    if (typeof intent !== "object" || intent === null) {
        throw new Error("assembleUdta: expected intent object");
    }

    const { children } = intent;

    if (!Array.isArray(children)) {
        throw new Error(
            "assembleUdta: 'children' must be an array"
        );
    }

    const childNodes = [];

    for (let i = 0; i < children.length; i++) {

        const child = children[i];

        if (!child || typeof child !== "object") {
            throw new Error(
                `assembleUdta: children[${i}] must be an object`
            );
        }

        if (typeof child.type !== "string") {
            throw new Error(
                `assembleUdta: children[${i}].type must be a string`
            );
        }

        switch (child.type) {

            case "meta":
                childNodes.push(
                    EmitterRegistry.assemble(
                        "moov/udta/meta",
                        child
                    )
                );
                break;

            default:
                throw new Error(
                    `assembleUdta: unsupported child '${child.type}'`
                );
        }
    }

    return emitContainer(
        "moov/udta",
        {
            children: childNodes
        }
    );
}

export function registerUdtaAssembler(registry) {
    registry.registerAssembler(
        "moov/udta",
        assembleUdta
    );
}
