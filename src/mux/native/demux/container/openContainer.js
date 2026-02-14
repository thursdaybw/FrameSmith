import { openContainerFromMp4 } from "./openContainerFromMp4.js";
import { openContainerFromMp4Source } from "./openContainerFromMp4Source.js";
import { createWebmByteSourceFromUint8Array } from "./webmByteSource.js";
import { openContainerFromWebmSource } from "./openContainerFromWebmSource.js";

function normalizeContainerType(containerType) {
    if (typeof containerType !== "string") {
        return "";
    }
    return containerType.trim().toLowerCase();
}

function isUint8Array(value) {
    return value instanceof Uint8Array;
}

function looksLikeMp4Header(headerBytes) {
    if (!isUint8Array(headerBytes) || headerBytes.length < 8) {
        return false;
    }
    return (
        headerBytes[4] === 0x66 && // f
        headerBytes[5] === 0x74 && // t
        headerBytes[6] === 0x79 && // y
        headerBytes[7] === 0x70    // p
    );
}

function looksLikeWebmHeader(headerBytes) {
    if (!isUint8Array(headerBytes) || headerBytes.length < 4) {
        return false;
    }
    return (
        headerBytes[0] === 0x1A &&
        headerBytes[1] === 0x45 &&
        headerBytes[2] === 0xDF &&
        headerBytes[3] === 0xA3
    );
}

async function readHeaderFromByteSource({ byteSource, headerLength = 16 }) {
    if (!byteSource || typeof byteSource !== "object") {
        throw new Error("openContainer: byteSource must be an object when bytes are not provided");
    }
    if (typeof byteSource.readRange !== "function") {
        throw new Error("openContainer: byteSource.readRange must be a function");
    }

    let headerBytes = null;
    try {
        headerBytes = await byteSource.readRange({ offset: 0, length: headerLength });
    } catch {
        headerBytes = await byteSource.readRange(0, headerLength);
    }

    if (!isUint8Array(headerBytes)) {
        throw new Error("openContainer: byteSource.readRange must return Uint8Array");
    }
    return headerBytes;
}

async function resolveContainerType({ containerType, bytes, byteSource }) {
    const normalized = normalizeContainerType(containerType);
    if (normalized) {
        return normalized;
    }

    if (isUint8Array(bytes)) {
        if (looksLikeMp4Header(bytes)) return "mp4";
        if (looksLikeWebmHeader(bytes)) return "webm";
        throw new Error("openContainer: could not sniff container type from bytes");
    }

    const headerBytes = await readHeaderFromByteSource({
        byteSource,
        headerLength: 16
    });
    if (looksLikeMp4Header(headerBytes)) return "mp4";
    if (looksLikeWebmHeader(headerBytes)) return "webm";

    throw new Error("openContainer: could not sniff container type from byteSource");
}

export async function openContainer({
    containerType,
    byteSource,
    bytes
} = {}) {
    const resolvedContainerType = await resolveContainerType({
        containerType,
        bytes,
        byteSource
    });

    if (resolvedContainerType === "mp4") {
        if (isUint8Array(bytes)) {
            return openContainerFromMp4({ mp4Bytes: bytes });
        }
        return openContainerFromMp4Source({ mp4ByteSource: byteSource });
    }

    if (resolvedContainerType === "webm") {
        if (isUint8Array(bytes)) {
            const webmByteSource = createWebmByteSourceFromUint8Array({ webmBytes: bytes });
            return openContainerFromWebmSource({ webmByteSource });
        }
        return openContainerFromWebmSource({ webmByteSource: byteSource });
    }

    throw new Error(`openContainer: unsupported containerType '${resolvedContainerType}'`);
}
