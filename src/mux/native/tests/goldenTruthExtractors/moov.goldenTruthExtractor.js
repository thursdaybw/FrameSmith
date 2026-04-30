import { asIsoBoxContainer } from "../../box-model/Box.js";
import { getGoldenTruthBox } from "./index.js";

/**
 * moov — Movie Box (Golden Truth Extractor)
 * =======================================
 *
 * Structural container for movie metadata.
 *
 * Rules:
 * - moov has no fields of its own
 * - required child: mvhd
 * - required children: one or more trak
 * - optional child: udta
 * - no policy
 * - no inference
 * - no mutation
 */

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("moov.readBoxReport: expected Uint8Array");
    }

    const container =
        asIsoBoxContainer(
            boxBytes,
            "moov"
        );

    const children = container.enumerateChildren();
    const childrenMap = {};

    for (const child of children) {
        childrenMap[child.type] = { type: child.type };
    }

    return {
        raw: boxBytes,

        box: {
            type: "moov",
            children: childrenMap
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------
function getEmitterInput(boxBytes) {

    // ---------------------------------------------------------
    // readBoxReport (pins canonical moov container)
    // ---------------------------------------------------------
    const read = readBoxReport(boxBytes);

    /**
     * Canonical container pin.
     * This Uint8Array MUST be used for all child resolution.
     */
    const moovRaw = read.raw;

    // ---------------------------------------------------------
    // mvhd (required, single)
    // ---------------------------------------------------------
    const mvhd =
        getGoldenTruthBox
            .getSemanticBoxDataFromBox({
                boxBytes: moovRaw,
                sourceRegistryKey: "moov",
                targetBoxPath: "moov/mvhd"
            })
            .getEmitterInput();

    // ---------------------------------------------------------
    // traks (required, plural, ordered)
    // ---------------------------------------------------------
    const traks = [];
    let index = 0;

    while (true) {
        try {
            const truth =
                getGoldenTruthBox
                    .getSemanticBoxDataFromBox({
                        boxBytes: moovRaw,
                        sourceRegistryKey: "moov",
                        targetBoxPath: `moov/trak[${index}]`
                    });

            traks.push(truth.getEmitterInput());
            index++;
        }
        catch {
            break;
        }
    }

    if (traks.length === 0) {
        throw new Error("moov.getEmitterInput: no trak boxes found");
    }

    // ---------------------------------------------------------
    // Optional udta
    // ---------------------------------------------------------
    let udta;

    if (read.box.children.udta) {
        udta =
            getGoldenTruthBox
                .getSemanticBoxDataFromBox({
                    boxBytes: moovRaw,
                    sourceRegistryKey: "moov",
                    targetBoxPath: "moov/udta"
                })
                .getEmitterInput();
    }

    return {
        mvhd,
        traks,
        ...(udta ? { udta } : {})
    };
}


// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerMoovGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
