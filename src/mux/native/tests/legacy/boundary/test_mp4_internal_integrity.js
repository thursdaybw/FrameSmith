import { NativeMuxer } from "../../NativeMuxer.js";

export async function test_mp4_internal_integrity() {
    console.log("=== boundary: test_mp4_internal_integrity ===");

    // ------------------------------------------------------------------
    // 1. Prepare known SPS/PPS + simple P-frame sample
    // ------------------------------------------------------------------
    const spspps = new Uint8Array([
        0,0,0,1, 0x67,0x42,0xC0,0x0B, 0x8C,0x68,0x42,0x49,0xA8,0x08,0x08,0x08,0x3C,0x22,0x11,0xA8,
        0,0,0,1, 0x68,0xCE,0x3C,0x80
    ]);

    const pframe = new Uint8Array([
        0,0,0,1, 0x61,0xE0,0x00,0x7E, 0x40,0x9F,0xE1,0x48,0xA0,
        0x00,0x72,0x28,0x00,0x1C,0x8A,0x00,0x07,0x22,0x80,0x01,
        0xC8,0xA0,0x00,0x72,0x28,0x00,0x1C,0x8A,0x00,0x07,0x22,
        0x80,0x01,0xC8,0xE0,0x00,0x20,0x03,0x1C,0x00,0x04,
        0x49,0x71,0x38,0xBC,0x4F,0x89,0xF3,0xD8,0xBC,0xFE,0x7F,
        0x3F,0x9E,0xF3,0xF9,0xFC,0xFE
    ]);

    // ------------------------------------------------------------------
    // 2. Build MP4 via muxer
    // ------------------------------------------------------------------
    const muxer = new NativeMuxer({
        codec: "avc1.42E01E",
        width: 64,
        height: 64,
        fps: 30
    });

    muxer.addVideoFrame({
        timestamp: 0,
        duration: 33333,
        byteLength: spspps.length,
        copyTo: out => out.set(spspps)
    });

    muxer.addVideoFrame({
        timestamp: 33333,
        duration: 33333,
        byteLength: pframe.length,
        copyTo: out => out.set(pframe)
    });

    const blob = await muxer.finalize();
    const buffer = new Uint8Array(await blob.arrayBuffer());

    // ------------------------------------------------------------------
    // 3. Parse MP4 to find ftyp, moov, mdat
    // ------------------------------------------------------------------
    function readBox(offset) {
        const size =
            (buffer[offset] << 24) |
            (buffer[offset+1] << 16) |
            (buffer[offset+2] << 8) |
            buffer[offset+3];

        const type = String.fromCharCode(
            buffer[offset+4],
            buffer[offset+5],
            buffer[offset+6],
            buffer[offset+7]
        );

        return { offset, size, type };
    }

    const ftyp = readBox(0);
    if (ftyp.type !== "ftyp") throw new Error("FAIL: first box not ftyp");

    const moov = readBox(ftyp.offset + ftyp.size);
    if (moov.type !== "moov") throw new Error("FAIL: second box not moov");

    const mdat = readBox(moov.offset + moov.size);
    if (mdat.type !== "mdat") throw new Error("FAIL: third box not mdat");

    console.log("MP4 box layout:");
    console.log("  ftyp:", ftyp);
    console.log("  moov:", moov);
    console.log("  mdat:", mdat);

    // ------------------------------------------------------------------
    // 4. Extract stsz + stco from moov USING RECURSIVE DESCENT
    // ------------------------------------------------------------------

    function walkBoxes(offset, size, result) {
        const end = offset + size;
        let p = offset + 8; // skip header

        while (p < end) {
            const boxSize =
                (buffer[p] << 24) |
                (buffer[p+1] << 16) |
                (buffer[p+2] << 8) |
                buffer[p+3];

            const type = String.fromCharCode(
                buffer[p+4],
                buffer[p+5],
                buffer[p+6],
                buffer[p+7]
            );

            // record final targets
            if (type === "stsz") result.stsz = { offset: p, size: boxSize };
            if (type === "stco") result.stco = { offset: p, size: boxSize };

            // recursively walk children (generic box container check)
            function isContainer(type) {
                return (
                    type === "moov" ||
                    type === "trak" ||
                    type === "mdia" ||
                    type === "minf" ||
                    type === "stbl"
                );
            }

            if (isContainer(type)) {
                walkBoxes(p, boxSize, result);
            }

            p += boxSize;
        }
    }

    // RUN WALKER STARTING AT moov ROOT
    const found = { stsz: null, stco: null };
    walkBoxes(moov.offset, moov.size, found);

    if (!found.stsz) throw new Error("FAIL: stsz box missing");
    if (!found.stco) throw new Error("FAIL: stco box missing");

    const stsz = found.stsz;
    const stco = found.stco;

    // ------------------------------------------------------------------
    // 5. Read sample sizes
    // ------------------------------------------------------------------
    const sampleCount =
        (buffer[stsz.offset+12] << 24) |
        (buffer[stsz.offset+13] << 16) |
        (buffer[stsz.offset+14] << 8) |
        buffer[stsz.offset+15];

    if (sampleCount !== 2) {
        throw new Error(`FAIL: sampleCount expected 2, got ${sampleCount}`);
    }

    function readSampleSize(i) {
        const base = stsz.offset + 16 + i*4;
        return (
            (buffer[base] << 24) |
            (buffer[base+1] << 16) |
            (buffer[base+2] << 8) |
            buffer[base+3]
        );
    }

    const size0 = readSampleSize(0);
    const size1 = readSampleSize(1);

    console.log("Sample sizes:", size0, size1);

    // ------------------------------------------------------------------
    // 6. Read chunk offsets
    // ------------------------------------------------------------------
    const entryCount =
        (buffer[stco.offset+12] << 24) |
        (buffer[stco.offset+13] << 16) |
        (buffer[stco.offset+14] << 8) |
        buffer[stco.offset+15];

    if (entryCount !== 2)
        throw new Error(`FAIL: stco entries expected 2, got ${entryCount}`);

    function readOffset(i) {
        const base = stco.offset + 16 + i*4;
        return (
            (buffer[base] << 24) |
            (buffer[base+1] << 16) |
            (buffer[base+2] << 8) |
            buffer[base+3]
        );
    }

    const off0 = readOffset(0);
    const off1 = readOffset(1);

    console.log("Offsets:", off0, off1);

    // ------------------------------------------------------------------
    // 7. Validate offsets are inside mdat
    // ------------------------------------------------------------------
    if (off0 < mdat.offset + 8) throw new Error("FAIL: offset0 points before mdat payload");
    if (off1 < mdat.offset + 8) throw new Error("FAIL: offset1 points before mdat payload");

    // ------------------------------------------------------------------
    // 8. Validate samples do not overlap or overflow
    // ------------------------------------------------------------------
    if (off1 !== off0 + size0) {
        throw new Error("FAIL: sample1 offset does not match sample0 end");
    }

    const mdatEnd = mdat.offset + mdat.size;
    if (off0 + size0 > mdatEnd) throw new Error("FAIL: sample0 overflows mdat");
    if (off1 + size1 > mdatEnd) throw new Error("FAIL: sample1 overflows mdat");

    // ------------------------------------------------------------------
    // 9. Validate NAL prefix correctness inside the final MP4
    // ------------------------------------------------------------------
    function validateLengthPrefixedNAL(addr, size) {
        let p = addr;
        const end = addr + size;

        while (p < end) {
            const declared =
                (buffer[p] << 24) |
                (buffer[p+1] << 16) |
                (buffer[p+2] << 8) |
                buffer[p+3];

            const nalStart = p + 4;
            const nalEnd = nalStart + declared;

            if (nalEnd > end)
                throw new Error("FAIL: NAL overruns sample boundary");

            p = nalEnd;
        }
    }

    validateLengthPrefixedNAL(off0, size0);
    validateLengthPrefixedNAL(off1, size1);

    console.log("PASS: Internal MP4 structure is consistent");
}
