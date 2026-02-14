import { assertEqual } from "./assertions.js";
import { readElementHeader } from "../demux/webm/ebml/byteReaders/readElementHeader.js";
import { walkEbmlElements } from "../demux/webm/ebml/walkEbmlElements.js";

export async function test_webm_readElementHeader_decodesEbmlHeaderElement() {
    const bytes = new Uint8Array([
        0x1a, 0x45, 0xdf, 0xa3, // EBML header element ID
        0x84,                   // size = 4
        0x42, 0x86, 0x81, 0x01  // payload bytes
    ]);

    const out = readElementHeader(bytes, 0);
    assertEqual("element id", out.id, 0x1a45dfa3);
    assertEqual("element idLength", out.idLength, 4);
    assertEqual("element size", out.size, 4);
    assertEqual("element sizeLength", out.sizeLength, 1);
    assertEqual("element dataOffset", out.dataOffset, 5);
    assertEqual("element dataEndOffset", out.dataEndOffset, 9);
    assertEqual("element nextOffset", out.nextOffset, 9);
    assertEqual("element unknownSize", out.unknownSize, false);
}

export async function test_webm_readElementHeader_marksUnknownSize() {
    const bytes = new Uint8Array([
        0x81, // id
        0xff  // unknown-size marker for length=1
    ]);

    const out = readElementHeader(bytes, 0);
    assertEqual("unknown-size flagged", out.unknownSize, true);
}

export async function test_webm_walkEbmlElements_walksFlatRange() {
    const bytes = new Uint8Array([
        0x81, 0x81, 0xaa,             // id=0x81, size=1, payload=[0xaa]
        0x42, 0x86, 0x82, 0x01, 0x02  // id=0x4286, size=2, payload=[0x01,0x02]
    ]);

    const entries = [...walkEbmlElements({ bytes })];
    assertEqual("flat entry count", entries.length, 2);
    assertEqual("flat first id", entries[0].id, 0x81);
    assertEqual("flat second id", entries[1].id, 0x4286);
    assertEqual("flat first depth", entries[0].depth, 0);
    assertEqual("flat second depth", entries[1].depth, 0);
}

export async function test_webm_walkEbmlElements_walksNestedContainerRange() {
    const bytes = new Uint8Array([
        0xe0, 0x83,       // parent id=0xe0, size=3
        0x81, 0x81, 0xff  // child id=0x81, size=1, payload=[0xff]
    ]);

    const entries = [...walkEbmlElements({
        bytes,
        isContainerElement(id) {
            return id === 0xe0;
        }
    })];

    assertEqual("nested entry count", entries.length, 2);
    assertEqual("nested parent depth", entries[0].depth, 0);
    assertEqual("nested child depth", entries[1].depth, 1);
    assertEqual("nested child parentId", entries[1].parentId, 0xe0);
}

export async function test_webm_walkEbmlElements_rejectsUnknownSizeElements() {
    const bytes = new Uint8Array([
        0x81, 0xff
    ]);

    let threw = false;
    try {
        [...walkEbmlElements({ bytes })];
    } catch (error) {
        threw = /unknown-size element not supported yet/.test(String(error?.message ?? error));
    }
    assertEqual("walker unknown-size rejection", threw, true);
}

export const WEBM_EBML_PRIMITIVE_TESTS = [
    test_webm_readElementHeader_decodesEbmlHeaderElement,
    test_webm_readElementHeader_marksUnknownSize,
    test_webm_walkEbmlElements_walksFlatRange,
    test_webm_walkEbmlElements_walksNestedContainerRange,
    test_webm_walkEbmlElements_rejectsUnknownSizeElements
];

