/**
 * BoxExtractor
 * ============
 *
 * Single, authoritative MP4 box extraction utility for tests.
 *
 * CONTRACT:
 * ---------
 * - All inputs are FULL box byte arrays:
 *     size (4) + type (4) + payload
 * - All offsets are relative to the start of the box
 * - No function accepts "payload-only" buffers
 *
 * RESPONSIBILITIES:
 * -----------------
 * - Traverse MP4 box hierarchies
 * - Handle SampleEntry (avc1, mp4a, etc)
 * - Locate child boxes without assuming fixed offsets
 *
 * NON-RESPONSIBILITIES:
 * ---------------------
 * - No decoding of codec data
 * - No interpretation of SPS/PPS
 * - No mutation of buffers
 *
 * If extraction logic changes, it changes here and nowhere else.
 */

// ------------------------------------------------------------
// Private low-level readers (STRUCTURAL intent)
// ------------------------------------------------------------

function readUint32(buffer, offset) {
    return (
        (buffer[offset]     << 24) |
        (buffer[offset + 1] << 16) |
        (buffer[offset + 2] << 8)  |
        buffer[offset + 3]
    ) >>> 0;
}

function readBoxType(buffer, offset) {
    return String.fromCharCode(
        buffer[offset],
        buffer[offset + 1],
        buffer[offset + 2],
        buffer[offset + 3]
    );
}

// ------------------------------------------------------------
// Core traversal helpers (PRIVATE)
// ------------------------------------------------------------

function scanChildBoxes(buffer, startOffset, fourcc) {
    let offset = startOffset;

    while (offset + 8 <= buffer.length) {
        const size = readUint32(buffer, offset);
        const type = readBoxType(buffer, offset + 4);

        if (type === fourcc) {
            return buffer.slice(offset, offset + size);
        }

        if (size < 8) break;
        offset += size;
    }

    throw new Error(`FAIL: child box '${fourcc}' not found`);
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export function extractBoxByPath(buffer, path) {

    function findChild(start, end, targetType, isRoot) {
        let offset = isRoot ? start : start + 8;

        while (offset < end) {
            const size = readUint32(buffer, offset);
            if (size < 8) break;

            const type = readBoxType(buffer, offset + 4);
            const next = offset + size;

            if (type === targetType) {
                return { start: offset, end: next };
            }

            offset = next;
        }

        return null;
    }

    let current = { start: 0, end: buffer.length };
    let isRoot = true;

    for (const segment of path) {
        const found = findChild(
            current.start,
            current.end,
            segment,
            isRoot
        );

        if (!found) {
            throw new Error(
                `extractBoxByPath: Missing box '${segment}' in path ${path.join("/")}`
            );
        }

        current = found;
        isRoot = false;
    }

    return buffer.slice(current.start, current.end);
}

export function extractChildBoxFromContainer(containerBox, fourcc) {
    // size (4) + type (4)
    return scanChildBoxes(containerBox, 8, fourcc);
}

export function extractChildBoxFromSampleEntry(sampleEntryBox, fourcc) {
    const sampleEntryType = readBoxType(sampleEntryBox, 4);

    if (sampleEntryType !== "avc1") {
        throw new Error(
            `Unsupported SampleEntry type '${sampleEntryType}'`
        );
    }

    // VisualSampleEntry layout:
    // size (4) + type (4) + fixed fields (78 bytes)
    const childrenOffset = 8 + 78;

    return scanChildBoxes(sampleEntryBox, childrenOffset, fourcc);
}

export function extractSampleEntry(stsdBox, fourcc) {
    // stsd layout:
    // size (4)
    // type (4)
    // version (1)
    // flags (3)
    // entry_count (4)

    let offset = 16;

    const entryCount =
        (stsdBox[12] << 24) |
        (stsdBox[13] << 16) |
        (stsdBox[14] << 8)  |
        stsdBox[15];

    for (let i = 0; i < entryCount; i++) {
        const size = readUint32(stsdBox, offset);
        const type = readBoxType(stsdBox, offset + 4);

        if (type === fourcc) {
            return stsdBox.slice(offset, offset + size);
        }

        offset += size;
    }

    throw new Error(
        `FAIL: sample entry '${fourcc}' not found in stsd`
    );
}

export function findFourCC(buffer, fourcc) {
    const codes = fourcc.split("").map(c => c.charCodeAt(0));
    const hits = [];

    for (let i = 0; i < buffer.length - 3; i++) {
        if (
            buffer[i]     === codes[0] &&
            buffer[i + 1] === codes[1] &&
            buffer[i + 2] === codes[2] &&
            buffer[i + 3] === codes[3]
        ) {
            hits.push(i);
        }
    }

    return hits;
}
