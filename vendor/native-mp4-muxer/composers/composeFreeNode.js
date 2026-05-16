import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * composeFreeNode
 * ===============
 *
 * Purpose
 * -------
 * Composes a canonical MP4 `free` box as a top-level node.
 *
 * This composer exists to provide symmetry with other top-level
 * composers (ftyp, moov) and to allow early materialization for
 * sizing purposes.
 *
 * Design constraints
 * ------------------
 * - Emits exactly one canonical FREE box
 * - Size is fixed at 8 bytes (header only)
 * - No payload
 * - No layout or padding policy
 * - Safe to materialize before MDAT
 */
export function composeFreeNode() {
    return EmitterRegistry.emit("free");
}
