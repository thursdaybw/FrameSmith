import { readElementHeader } from "./byteReaders/readElementHeader.js";

function defaultIsContainerElement() {
    return false;
}

export function* walkEbmlElements({
    bytes,
    startOffset = 0,
    endOffset = null,
    isContainerElement = defaultIsContainerElement,
    maxDepth = 32
} = {}) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("walkEbmlElements: bytes must be Uint8Array");
    }
    if (!Number.isInteger(startOffset) || startOffset < 0) {
        throw new Error("walkEbmlElements: startOffset must be a non-negative integer");
    }
    const resolvedEndOffset = endOffset === null ? bytes.length : endOffset;
    if (!Number.isInteger(resolvedEndOffset) || resolvedEndOffset < startOffset || resolvedEndOffset > bytes.length) {
        throw new Error("walkEbmlElements: endOffset must be an integer within bounds");
    }
    if (typeof isContainerElement !== "function") {
        throw new Error("walkEbmlElements: isContainerElement must be a function");
    }
    if (!Number.isInteger(maxDepth) || maxDepth < 0) {
        throw new Error("walkEbmlElements: maxDepth must be a non-negative integer");
    }

    function* walkRange(rangeStart, rangeEnd, depth, parentId) {
        if (depth > maxDepth) {
            throw new Error(`walkEbmlElements: maxDepth ${maxDepth} exceeded`);
        }

        let cursor = rangeStart;
        while (cursor < rangeEnd) {
            const header = readElementHeader(bytes, cursor);
            if (header.dataEndOffset > rangeEnd) {
                throw new Error(
                    `walkEbmlElements: element overruns parent range ` +
                    `(offset=${cursor}, id=0x${header.id.toString(16)}, end=${header.dataEndOffset}, parentEnd=${rangeEnd})`
                );
            }

            const entry = {
                ...header,
                depth,
                parentId
            };
            yield entry;

            if (header.unknownSize) {
                throw new Error(
                    `walkEbmlElements: unknown-size element not supported yet (id=0x${header.id.toString(16)})`
                );
            }

            if (isContainerElement(header.id) && header.size > 0) {
                yield* walkRange(
                    header.dataOffset,
                    header.dataEndOffset,
                    depth + 1,
                    header.id
                );
            }

            cursor = header.dataEndOffset;
        }
    }

    yield* walkRange(startOffset, resolvedEndOffset, 0, null);
}

