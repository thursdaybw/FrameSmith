import { readElementHeader } from "./byteReaders/readElementHeader.js";

function defaultIsContainerElement() {
    return false;
}

export function* walkEbmlElements({
    bytes,
    startOffset = 0,
    endOffset = null,
    isContainerElement = defaultIsContainerElement,
    allowUnknownSizeElements = false,
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
    if (typeof allowUnknownSizeElements !== "boolean") {
        throw new Error("walkEbmlElements: allowUnknownSizeElements must be a boolean");
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
            const resolvedDataEndOffset = header.unknownSize ? rangeEnd : header.dataEndOffset;
            if (resolvedDataEndOffset > rangeEnd) {
                throw new Error(
                    `walkEbmlElements: element overruns parent range ` +
                    `(offset=${cursor}, id=0x${header.id.toString(16)}, end=${resolvedDataEndOffset}, parentEnd=${rangeEnd})`
                );
            }

            const entry = {
                ...header,
                dataEndOffset: resolvedDataEndOffset,
                nextOffset: resolvedDataEndOffset,
                depth,
                parentId
            };
            yield entry;

            if (header.unknownSize) {
                if (!allowUnknownSizeElements) {
                    throw new Error(
                        `walkEbmlElements: unknown-size element not supported yet (id=0x${header.id.toString(16)})`
                    );
                }
                if (!isContainerElement(header.id)) {
                    throw new Error(
                        `walkEbmlElements: unknown-size element must be container (id=0x${header.id.toString(16)})`
                    );
                }
            }

            if (isContainerElement(header.id) && resolvedDataEndOffset > header.dataOffset) {
                yield* walkRange(
                    header.dataOffset,
                    resolvedDataEndOffset,
                    depth + 1,
                    header.id
                );
            }

            cursor = resolvedDataEndOffset;
        }
    }

    yield* walkRange(startOffset, resolvedEndOffset, 0, null);
}
