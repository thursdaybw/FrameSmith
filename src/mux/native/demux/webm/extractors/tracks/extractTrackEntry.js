import { WEBM_ELEMENT_IDS } from "../../ebml/webmElementIds.js";
import { readDirectChildElements } from "../../ebml/readDirectChildElements.js";
import { readUnsignedInteger } from "../../ebml/byteReaders/readUnsignedInteger.js";
import { readEbmlString } from "../../ebml/byteReaders/readEbmlString.js";
import { readEbmlFloat } from "../../ebml/byteReaders/readEbmlFloat.js";

function readVideoInfo(bytes, videoElement) {
    const children = readDirectChildElements(bytes, videoElement.dataOffset, videoElement.dataEndOffset);
    let pixelWidth = null;
    let pixelHeight = null;

    for (const child of children) {
        if (child.id === WEBM_ELEMENT_IDS.PIXEL_WIDTH) {
            pixelWidth = readUnsignedInteger(bytes, child.dataOffset, child.size);
            continue;
        }
        if (child.id === WEBM_ELEMENT_IDS.PIXEL_HEIGHT) {
            pixelHeight = readUnsignedInteger(bytes, child.dataOffset, child.size);
        }
    }

    return { pixelWidth, pixelHeight };
}

function readAudioInfo(bytes, audioElement) {
    const children = readDirectChildElements(bytes, audioElement.dataOffset, audioElement.dataEndOffset);
    let samplingFrequency = null;
    let channels = null;

    for (const child of children) {
        if (child.id === WEBM_ELEMENT_IDS.SAMPLING_FREQUENCY) {
            if (child.size === 4 || child.size === 8) {
                samplingFrequency = readEbmlFloat(bytes, child.dataOffset, child.size);
            } else {
                samplingFrequency = readUnsignedInteger(bytes, child.dataOffset, child.size);
            }
            continue;
        }
        if (child.id === WEBM_ELEMENT_IDS.CHANNELS) {
            channels = readUnsignedInteger(bytes, child.dataOffset, child.size);
        }
    }

    return { samplingFrequency, channels };
}

export function extractTrackEntry({ bytes, element }) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("extractTrackEntry: bytes must be Uint8Array");
    }
    if (!element || element.id !== WEBM_ELEMENT_IDS.TRACK_ENTRY) {
        throw new Error("extractTrackEntry: element must be TRACK_ENTRY");
    }

    const children = readDirectChildElements(bytes, element.dataOffset, element.dataEndOffset);

    let trackNumber = null;
    let trackType = null;
    let codecId = null;
    let codecPrivate = null;
    let video = null;
    let audio = null;

    for (const child of children) {
        if (child.id === WEBM_ELEMENT_IDS.TRACK_NUMBER) {
            trackNumber = readUnsignedInteger(bytes, child.dataOffset, child.size);
            continue;
        }
        if (child.id === WEBM_ELEMENT_IDS.TRACK_TYPE) {
            trackType = readUnsignedInteger(bytes, child.dataOffset, child.size);
            continue;
        }
        if (child.id === WEBM_ELEMENT_IDS.CODEC_ID) {
            codecId = readEbmlString(bytes, child.dataOffset, child.size);
            continue;
        }
        if (child.id === WEBM_ELEMENT_IDS.CODEC_PRIVATE) {
            codecPrivate = bytes.slice(child.dataOffset, child.dataEndOffset);
            continue;
        }
        if (child.id === WEBM_ELEMENT_IDS.VIDEO) {
            video = readVideoInfo(bytes, child);
            continue;
        }
        if (child.id === WEBM_ELEMENT_IDS.AUDIO) {
            audio = readAudioInfo(bytes, child);
        }
    }

    return {
        trackNumber,
        trackType,
        codecId,
        codecPrivate,
        video,
        audio
    };
}
