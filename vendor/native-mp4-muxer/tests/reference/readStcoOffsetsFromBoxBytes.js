/**
 * readStcoOffsetsFromBoxBytes
 * ==========================
 *
 * PURPOSE
 * -------
 * Extract the raw chunk offsets stored in an STCO box *exactly as encoded*.
 *
 * This function exists solely to support **locked-layout equivalence tests**
 * during the NativeMuxer bring-up phase.
 *
 * It is NOT a semantic parser.
 *
 * ------------------------------------------------------------
 * Why this exists
 * ------------------------------------------------------------
 *
 * STCO (Chunk Offset Box) is fundamentally different from most
 * MP4 boxes:
 *
 * - Its values are *derived*, not authored
 * - Its contents depend on final file layout
 * - It does not describe media meaning
 *
 * Because of this, STCO cannot be validated semantically
 * prior to full MP4 assembly.
 *
 * During early testing, however, we still need a way to:
 *
 *   - extract the exact offsets emitted by ffmpeg
 *   - inject those offsets verbatim into Framesmith builders
 *   - assert byte-for-byte serialization fidelity
 *
 * This function provides that capability explicitly and honestly.
 *
 * ------------------------------------------------------------
 * Architectural boundaries (NON-NEGOTIABLE)
 * ------------------------------------------------------------
 *
 * This function:
 *   - reads raw bytes only
 *   - performs no interpretation or validation
 *   - makes no assumptions about correctness
 *   - encodes no policy
 *
 * This function MUST NOT:
 *   - be used by NativeMuxer
 *   - be used by production code
 *   - infer chunking or layout rules
 *   - evolve into a semantic parser
 *
 * If STCO semantics are ever required, that logic belongs in
 * NativeMuxer finalization, not here.
 *
 * ------------------------------------------------------------
 * Historical note
 * ------------------------------------------------------------
 *
 * This reader was introduced after enforcing a strict parser
 * contract that forbids tests from parsing MP4 structure inline.
 *
 * STCO was identified as a special case where *reference data*
 * (not meaning) must be extracted to enable locked-layout tests
 * without violating architectural boundaries.
 *
 * This function is intentionally narrow to prevent boundary creep.
 */

import { readUint32 } from "../../bytes/mp4ByteReader.js";

export function readStcoOffsetsFromBoxBytes(boxBytes) {
    const entryCount = readUint32(boxBytes, 12);

    const offsets = [];
    let offset = 16;

    for (let i = 0; i < entryCount; i++) {
        offsets.push(readUint32(boxBytes, offset));
        offset += 4;
    }

    return offsets;
}
