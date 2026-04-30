function readUint32(bytes, offset) {
    return (
        ((bytes[offset] << 24) >>> 0) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]
    ) >>> 0;
}

function readBoxType(bytes, offset) {
    return String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
    );
}

function readBoxSizeFromBuffer(bytes, offset, endOffset) {
    const size32 = readUint32(bytes, offset);
    if (size32 === 0) {
        return endOffset - offset;
    }
    if (size32 === 1) {
        throw new Error("loadCo64OracleTrack0BoxBytes: large-size boxes are not supported");
    }
    return size32;
}

function findChildBox(bytes, parentStart, parentEnd, type, ordinal = 0) {
    let offset = parentStart;
    let seen = 0;
    while (offset + 8 <= parentEnd) {
        const boxSize = readBoxSizeFromBuffer(bytes, offset, parentEnd);
        if (boxSize < 8 || offset + boxSize > parentEnd) {
            throw new Error(`loadCo64OracleTrack0BoxBytes: invalid child size while scanning '${type}'`);
        }
        const boxType = readBoxType(bytes, offset);
        if (boxType === type) {
            if (seen === ordinal) {
                return { offset, size: boxSize, end: offset + boxSize, type: boxType };
            }
            seen += 1;
        }
        offset += boxSize;
    }
    return null;
}

async function readAt(fileHandle, offset, length) {
    const buffer = Buffer.allocUnsafe(length);
    const { bytesRead } = await fileHandle.read(buffer, 0, length, offset);
    if (bytesRead !== length) {
        throw new Error(`loadCo64OracleTrack0BoxBytes: short read at ${offset} (${bytesRead}/${length})`);
    }
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

async function findTopLevelBox(fileHandle, fileSize, targetType) {
    let offset = 0;
    while (offset + 8 <= fileSize) {
        const header = await readAt(fileHandle, offset, 8);
        let size = readUint32(header, 0);
        const type = readBoxType(header, 0);
        if (size === 0) {
            size = fileSize - offset;
        } else if (size === 1) {
            const large = await readAt(fileHandle, offset + 8, 8);
            const hi = readUint32(large, 0);
            const lo = readUint32(large, 4);
            size = hi * 2 ** 32 + lo;
        }
        if (!Number.isFinite(size) || size < 8 || offset + size > fileSize) {
            throw new Error(`loadCo64OracleTrack0BoxBytes: invalid top-level box at offset ${offset}`);
        }
        if (type === targetType) {
            return { offset, size, end: offset + size, type };
        }
        offset += size;
    }
    return null;
}

export async function loadCo64OracleTrack0BoxBytes({
    filePath = "src/mux/native/tests/reference/reference_co64.mp4"
} = {}) {
    if (typeof window !== "undefined") {
        throw new Error("loadCo64OracleTrack0BoxBytes: node-only");
    }

    const fs = await import("node:fs/promises");
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) {
        throw new Error(
            `missing oracle ${filePath}. ` +
            "Generate it using instructions in src/mux/native/tests/reference/README.md"
        );
    }

    const fileHandle = await fs.open(filePath, "r");
    try {
        const moov = await findTopLevelBox(fileHandle, stat.size, "moov");
        if (!moov) {
            throw new Error(`loadCo64OracleTrack0BoxBytes: moov not found in ${filePath}`);
        }

        const moovBytes = await readAt(fileHandle, moov.offset, moov.size);
        const moovStart = 8;
        const moovEnd = moovBytes.length;

        const trak0 = findChildBox(moovBytes, moovStart, moovEnd, "trak", 0);
        if (!trak0) throw new Error("loadCo64OracleTrack0BoxBytes: trak[0] not found");
        const mdia = findChildBox(moovBytes, trak0.offset + 8, trak0.end, "mdia", 0);
        if (!mdia) throw new Error("loadCo64OracleTrack0BoxBytes: mdia not found");
        const minf = findChildBox(moovBytes, mdia.offset + 8, mdia.end, "minf", 0);
        if (!minf) throw new Error("loadCo64OracleTrack0BoxBytes: minf not found");
        const stbl = findChildBox(moovBytes, minf.offset + 8, minf.end, "stbl", 0);
        if (!stbl) throw new Error("loadCo64OracleTrack0BoxBytes: stbl not found");
        const co64 = findChildBox(moovBytes, stbl.offset + 8, stbl.end, "co64", 0);
        if (!co64) {
            throw new Error(
                `loadCo64OracleTrack0BoxBytes: co64 not found in ${filePath}. ` +
                "Generate it using instructions in src/mux/native/tests/reference/README.md"
            );
        }

        return moovBytes.slice(co64.offset, co64.end);
    } finally {
        await fileHandle.close();
    }
}
