import { WEBM_ELEMENT_IDS } from "../../ebml/webmElementIds.js";
import { readDirectChildElements } from "../../ebml/readDirectChildElements.js";
import { readUnsignedInteger } from "../../ebml/byteReaders/readUnsignedInteger.js";
import { readEbmlFloat } from "../../ebml/byteReaders/readEbmlFloat.js";

export function extractSegmentInfo({ bytes, element }) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("extractSegmentInfo: bytes must be Uint8Array");
    }
    if (!element || element.id !== WEBM_ELEMENT_IDS.INFO) {
        throw new Error("extractSegmentInfo: element must be INFO");
    }

    const children = readDirectChildElements(bytes, element.dataOffset, element.dataEndOffset);
    let timecodeScale = 1_000_000; // WebM default
    let duration = null;

    for (const child of children) {
        if (child.id === WEBM_ELEMENT_IDS.TIMECODE_SCALE) {
            timecodeScale = readUnsignedInteger(bytes, child.dataOffset, child.size);
            continue;
        }
        if (child.id === WEBM_ELEMENT_IDS.DURATION) {
            duration = readEbmlFloat(bytes, child.dataOffset, child.size);
        }
    }

    return {
        timecodeScale,
        duration
    };
}
