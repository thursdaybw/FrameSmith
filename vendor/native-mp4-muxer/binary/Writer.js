export function writeUint32(out, offset, value) {
    out[offset    ] = (value >>> 24) & 0xFF;
    out[offset + 1] = (value >>> 16) & 0xFF;
    out[offset + 2] = (value >>>  8) & 0xFF;
    out[offset + 3] = (value       ) & 0xFF;
}

export function writeString(out, offset, str) {
    for (let i = 0; i < str.length; i++) {
        out[offset + i] = str.charCodeAt(i);
    }
}

export function writeUint16(out, offset, value) {
    out[offset    ] = (value >>> 8) & 0xFF;
    out[offset + 1] = (value      ) & 0xFF;
}
