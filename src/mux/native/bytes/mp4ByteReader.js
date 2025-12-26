/**
 * MP4 Primitive Byte Readers
 * ==========================
 *
 * Canonical readers for primitive field types defined by
 * ISO/IEC 14496-12 (ISO Base Media File Format).
 *
 * This module:
 * - contains NO traversal logic
 * - contains NO box knowledge
 * - contains NO diagnostics
 * - performs NO validation beyond raw reads
 *
 * It exists to prevent duplication and semantic drift.
 */

export function readUint16(bytes, offset) {
    return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
}

export function readUint32(bytes, offset) {
    return (
        (bytes[offset]     << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8)  |
        bytes[offset + 3]
    ) >>> 0;
}

export function readInt32(bytes, offset) {
    return (
        (bytes[offset]     << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8)  |
        bytes[offset + 3]
    );
}

export function readUint64(bytes, offset) {
    const high = readUint32(bytes, offset);
    const low  = readUint32(bytes, offset + 4);
    return high * 0x100000000 + low;
}

export function readInt64(bytes, offset) {
    const high = readInt32(bytes, offset);
    const low  = readUint32(bytes, offset + 4);
    return high * 0x100000000 + low;
}

export function readFourCC(bytes, offset) {
    return String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
    );
}
