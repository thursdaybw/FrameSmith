import { assertEqual } from "./assertions.js";
import { readVint } from "../demux/webm/ebml/byteReaders/readVint.js";

export async function test_webm_readVint_decodesOneByteSizeVint() {
    const bytes = new Uint8Array([0x81]);
    const out = readVint(bytes, 0);

    assertEqual("one-byte vint length", out.length, 1);
    assertEqual("one-byte vint value", out.value, 1);
    assertEqual("one-byte vint offset", out.offset, 0);
    assertEqual("one-byte vint nextOffset", out.nextOffset, 1);
}

export async function test_webm_readVint_decodesTwoByteSizeVint() {
    const bytes = new Uint8Array([0x40, 0x7f]);
    const out = readVint(bytes, 0);

    assertEqual("two-byte vint length", out.length, 2);
    assertEqual("two-byte vint value", out.value, 127);
    assertEqual("two-byte vint nextOffset", out.nextOffset, 2);
}

export async function test_webm_readVint_decodesEbmlIdWhenPreserveLengthBitEnabled() {
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
    const out = readVint(bytes, 0, { preserveLengthBit: true });

    assertEqual("ebml id vint length", out.length, 4);
    assertEqual("ebml id vint value", out.value, 0x1a45dfa3);
}

export async function test_webm_readVint_respectsOffset() {
    const bytes = new Uint8Array([0x00, 0x00, 0x82]);
    const out = readVint(bytes, 2);

    assertEqual("offset vint length", out.length, 1);
    assertEqual("offset vint value", out.value, 2);
    assertEqual("offset vint nextOffset", out.nextOffset, 3);
}

export async function test_webm_readVint_rejectsInvalidLeadingByte() {
    let threw = false;
    try {
        readVint(new Uint8Array([0x00]), 0);
    } catch (error) {
        threw = /invalid VINT/.test(String(error?.message ?? error));
    }
    assertEqual("invalid leading byte must throw", threw, true);
}

export async function test_webm_readVint_rejectsTruncatedVint() {
    let threw = false;
    try {
        readVint(new Uint8Array([0x40]), 0);
    } catch (error) {
        threw = /truncated VINT/.test(String(error?.message ?? error));
    }
    assertEqual("truncated vint must throw", threw, true);
}

export const WEBM_READ_VINT_TESTS = [
    test_webm_readVint_decodesOneByteSizeVint,
    test_webm_readVint_decodesTwoByteSizeVint,
    test_webm_readVint_decodesEbmlIdWhenPreserveLengthBitEnabled,
    test_webm_readVint_respectsOffset,
    test_webm_readVint_rejectsInvalidLeadingByte,
    test_webm_readVint_rejectsTruncatedVint
];

