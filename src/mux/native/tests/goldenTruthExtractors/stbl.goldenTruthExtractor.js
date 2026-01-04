import { extractChildBoxFromContainer } from "../reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./index.js";

import { emitStsdBox } from "../../box-emitters/stsdBox.js";
import { emitSttsBox } from "../../box-emitters/sttsBox.js";
import { emitStssBox } from "../../box-emitters/stssBox.js";
import { emitCttsBox } from "../../box-emitters/cttsBox.js";
import { emitStscBox } from "../../box-emitters/stscBox.js";
import { emitStszBox } from "../../box-emitters/stszBox.js";
import { emitStcoBox } from "../../box-emitters/stcoBox.js";

function readStblBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("stbl.readFields: expected Uint8Array");
    }

    return {
        raw: box
    };
}

function getStblBuildParamsFromBoxBytes(box) {

    /**
     * emitChild
     * ---------
     *
     * Semantic rebuild helper for STBL child boxes.
     *
     * What this does:
     * - Structurally extracts a named child box from the STBL container
     * - Delegates to the registered golden truth extractor for that box
     * - Re-emits the box via its corresponding emitter
     *
     * This function represents the *semantic rebuild pipeline*:
     *
     *   raw bytes
     *     → golden truth parameters
     *       → deterministic re-emission
     *
     * What this function assumes:
     * - The child box is a standard ISO BMFF box
     * - A golden truth extractor exists for the box type
     * - A corresponding emitter exists
     * - Byte-for-byte equivalence with the source MP4 is expected
     *
     * What this function MUST NOT be used for:
     * - SampleEntry boxes (e.g. avc1, mp4a)
     * - Codec-specific payloads
     * - Opaque or partially-implemented boxes (e.g. sbgp, sgpd at this stage)
     *
     * If a box cannot be semantically rebuilt yet, it must NOT pass through
     * this function.
     *
     * @param {string} name
     *   FourCC of the child box (e.g. "stts", "stsc")
     *
     * @param {Function} emitter
     *   Box emitter function responsible for re-emission
     *
     * @returns {Object}
     *   Box node suitable for inclusion in emitStblBox(...)
     */
    function emitChild(name, emitter) {
        const childBytes = extractChildBoxFromContainer(box, name);

        const params = getGoldenTruthBox
            .fromBox(
                childBytes,
                `moov/trak/mdia/minf/stbl/${name}`
            )
            .getBuilderInput();

        return emitter(params);
    }

    /**
     * STBL build parameters
     * --------------------
     *
     * This object intentionally distinguishes between:
     *
     * 1. Rebuildable semantic children
     *    - Parsed via golden truth extractors
     *    - Re-emitted via dedicated emitters
     *
     * 2. Leaf boxes (opaque at this stage)
     *    - Structurally valid children of STBL
     *    - Traversed and preserved byte-for-byte
     *    - NOT semantically rebuilt yet
     *
     * This distinction is critical.
     *
     * Not every child of STBL is rebuildable.
     * Treating leaf boxes as semantic boxes will cause traversal failures.
     *
     * Accessors are used instead of eager evaluation so that:
     * - Structural tests do not trigger semantic rebuilds
     * - Audio-only structures do not trigger video-only code paths
     * - Partially implemented boxes do not break unrelated tests
     */
    return {
        get stsd() { return emitChild("stsd", emitStsdBox); },
        get stts() { return emitChild("stts", emitSttsBox); },
        get stss() { return emitChild("stss", emitStssBox); },
        get ctts() { return emitChild("ctts", emitCttsBox); },
        get stsc() { return emitChild("stsc", emitStscBox); },
        get stsz() { return emitChild("stsz", emitStszBox); },
        get stco() { return emitChild("stco", emitStcoBox); },

        /**
         * sbgp — leaf box (no semantic rebuild)
         *
         * sbgp is a valid structural child of STBL, but at this stage
         * of the system it is treated as an opaque box.
         *
         * Responsibilities here are strictly:
         * - locate the box structurally
         * - preserve its raw bytes
         *
         * sbgp must NOT pass through emitChild because:
         * - no golden truth semantic model exists yet
         * - no emitter-driven reconstruction is implemented
         *
         * Byte-for-byte preservation is enforced by higher-level tests.
         */
        get sbgp() {
            return extractChildBoxFromContainer(box, "sbgp");
        }

    };
}

export function registerStblGoldenTruthExtractor(register) {
    register.readFields(readStblBoxFieldsFromBoxBytes);
    register.getBuilderInput(getStblBuildParamsFromBoxBytes);
}
