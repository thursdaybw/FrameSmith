import { emitMdatBox } from "./box-emitters/mdatBox.js";
import { emitFreeBox } from "./box-emitters/freeBox.js";
import { serializeBoxTree } from "./serializer/serializeBoxTree.js";

const ALLOWED_KEYS = [
    "ftypNode",
    "committedMoovNode",
    "mdatPayload",
    "fileBoxOrder"
];


/**
 * emitMp4FileFromResolvedParts
 * ===========================
 *
 * Emits a complete MP4 file from fully resolved, finalized parts.
 *
 * ---------------------------------------------------------------------------
 * What this function is (compiler term)
 * ---------------------------------------------------------------------------
 *
 * This function is a **linker**.
 *
 * In compiler terminology, a linker is the final step that:
 *   - takes already-finished pieces
 *   - places them in a specific order
 *   - joins them into one final output file
 *
 * A linker does NOT decide *what* those pieces are.
 * It only decides *how they are joined together*.
 *
 * ---------------------------------------------------------------------------
 * What this function is (plain language)
 * ---------------------------------------------------------------------------
 *
 * Think of this like putting together a finished book:
 *
 *   - the chapters are already written
 *   - the page numbers are already known
 *   - the layout is already decided
 *
 * This function simply:
 *   - puts the chapters in the correct order
 *   - glues them together
 *   - hands you the final book
 *
 * It does NOT:
 *   - edit the text
 *   - choose the layout
 *   - decide what chapters exist
 *
 * ---------------------------------------------------------------------------
 * What this function explicitly does NOT do
 * ---------------------------------------------------------------------------
 *
 * This function performs:
 *   - NO semantic derivation
 *   - NO container policy decisions
 *   - NO physical layout calculation
 *   - NO mutation of box structure
 *
 * All of those decisions must already be resolved *before* calling this.
 *
 * ---------------------------------------------------------------------------
 * Architectural role
 * ---------------------------------------------------------------------------
 *
 * This is a **low-level terminal utility**.
 *
 * It exists solely as the final byte-concatenation step after:
 *   - structure is finalized
 *   - policies are applied
 *   - layout is resolved
 *
 * Most callers should NOT use this directly.
 *
 * The primary production entry point is a higher-level compilation
 * pipeline (for example: compileMp4FromSemanticInputs).
 *
 * This function is intentionally small, boring, and mechanical.
 * That is a feature, not a limitation.
 */
export function emitMp4FileFromResolvedParts(params) {
    if (!params || typeof params !== "object") {
        throw new Error("emitMp4FileFromResolvedParts: expected parameter object");
    }

    const keys = Object.keys(params);

    for (const key of keys) {
        if (!ALLOWED_KEYS.includes(key)) {
            throw new Error(
                `emitMp4FileFromResolvedParts: unknown parameter '${key}'`
            );
        }
    }

    const {
        ftypNode,
        committedMoovNode,
        mdatPayload,
        fileBoxOrder
    } = params;

    if (!ftypNode) {
        throw new Error("emitMp4FileFromResolvedParts: ftypNode is required");
    }

    if (!committedMoovNode) {
        throw new Error("emitMp4FileFromResolvedParts: committedMoovNode is required");
    }

    if (!(mdatPayload instanceof Uint8Array)) {
        throw new Error("emitMp4FileFromResolvedParts: mdatPayload must be Uint8Array");
    }

    if (!Array.isArray(fileBoxOrder)) {
        throw new Error("emitMp4FileFromResolvedParts: fileBoxOrder must be an array");
    }

    if (typeof ftypNode.type !== "string") {
        throw new Error("emitMp4FileFromResolvedParts: ftypNode must be a box node");
    }

    if (typeof committedMoovNode.type !== "string") {
        throw new Error("emitMp4FileFromResolvedParts: committedMoovNode must be a box node");
    }

    const parts = [];

    for (const boxType of fileBoxOrder) {
        if (boxType === "ftyp") {
            parts.push(serializeBoxTree(ftypNode));
            continue;
        }

        if (boxType === "free") {
            parts.push(serializeBoxTree(emitFreeBox()));
            continue;
        }

        if (boxType === "mdat") {
            const mdatNode = emitMdatBox({ payload: mdatPayload });
            parts.push(serializeBoxTree(mdatNode));
            continue;
        }

        if (boxType === "moov") {
            parts.push(serializeBoxTree(committedMoovNode));
            continue;
        }

        throw new Error(`emitMp4FileFromResolvedParts: unknown box type '${boxType}'`);
    }

    const totalSize = parts.reduce((sum, bytes) => sum + bytes.length, 0);
    const outBytes = new Uint8Array(totalSize);

    let offset = 0;
    for (const bytes of parts) {
        outBytes.set(bytes, offset);
        offset += bytes.length;
    }

    return outBytes;
}
