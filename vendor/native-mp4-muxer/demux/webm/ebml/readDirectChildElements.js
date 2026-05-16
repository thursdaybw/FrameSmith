import { readElementHeader } from "./byteReaders/readElementHeader.js";

export function readDirectChildElements(bytes, startOffset, endOffset, options = {}) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("readDirectChildElements: bytes must be Uint8Array");
    }
    if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
        throw new Error("readDirectChildElements: offsets must be integers");
    }
    if (startOffset < 0 || endOffset < startOffset || endOffset > bytes.length) {
        throw new Error("readDirectChildElements: invalid range");
    }

    const allowUnknownSizeElements = options.allowUnknownSizeElements === true;
    const children = [];
    let cursor = startOffset;
    while (cursor < endOffset) {
        const header = readElementHeader(bytes, cursor);
        if (header.unknownSize) {
            if (!allowUnknownSizeElements) {
                throw new Error(
                    `readDirectChildElements: unknown-size child not allowed (id=0x${header.id.toString(16)})`
                );
            }
            children.push({
                ...header,
                dataEndOffset: endOffset,
                nextOffset: endOffset
            });
            cursor = endOffset;
            continue;
        }

        if (header.dataEndOffset > endOffset) {
            throw new Error(
                `readDirectChildElements: child overruns parent range (id=0x${header.id.toString(16)})`
            );
        }
        children.push(header);
        cursor = header.dataEndOffset;
    }
    return children;
}
