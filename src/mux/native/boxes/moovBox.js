import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * Concatenate Uint8Arrays into a new Uint8Array.
 */
function concat(arrays) {
    let total = 0;
    for (const a of arrays) total += a.length;

    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
        out.set(a, offset);
        offset += a.length;
    }
    return out;
}

/**
 * Create a simple MP4 box from a type and payload Uint8Array.
 */
function box(type, payloadBytes) {
    const size = 8 + payloadBytes.length;
    const out = new Uint8Array(size);

    writeUint32(out, 0, size);
    writeString(out, 4, type);
    out.set(payloadBytes, 8);

    return out;
}

/**
 * Build a `dinf` box containing a `dref` box.
 */
function buildDinfBox(dref) {
    // dinf payload is just the dref box
    return box("dinf", dref);
}

/**
 * Build a `minf` box:
 *
 * minf
 *   vmhd
 *   dinf(dref)
 *   stbl(stsd, stts, stsc, stsz, stco)
 */
function buildMinfBox(vmhd, dref, stsd, stts, stsc, stsz, stco) {

    console.log("MINF ENTRY STSZ:");
    console.log("  stsz len =", stsz.length);
    console.log("  stsz header =", Array.from(stsz.slice(0, 16)));

    console.log("MINF: VALIDATE BEFORE CONCAT");
    for (const [name, box] of Object.entries({ stsd, stts, stsc, stsz, stco })) {
        const size = (box[0]<<24)|(box[1]<<16)|(box[2]<<8)|box[3];
        const type = String.fromCharCode(box[4], box[5], box[6], box[7]);
        console.log("  ", name, "size =", size, "type =", type);
        console.log("    first 16 =", Array.from(box.slice(0,16)));
    }

    // Build dinf wrapper
    const dinf = buildDinfBox(dref);

    // Build stbl
    const stblPayload = concat([stsd, stts, stsc, stsz, stco]);

    console.log("STBL PAYLOAD STSZ SEGMENT:");
    console.log("  stsz len =", stsz.length);
    console.log("  stsz header =", Array.from(stsz.slice(0, 16)));

    console.log("MINF: STBL PAYLOAD LENGTH =", stblPayload.length);
    console.log("MINF: STBL PAYLOAD FIRST 32 =", Array.from(stblPayload.slice(0,32)));

    const stbl = box("stbl", stblPayload);

    console.log("MINF: STBL BOX SIZE =", (stbl[0]<<24)|(stbl[1]<<16)|(stbl[2]<<8)|stbl[3]);
    console.log("MINF: STBL FIRST 32 =", Array.from(stbl.slice(0,32)));

    const payload = concat([vmhd, dinf, stbl]);
    return box("minf", payload);
}

/**
 * Build `mdia`:
 *
 * mdia
 *   mdhd
 *   hdlr
 *   minf(...)
 */
function buildMdiaBox(mdhd, hdlr, minf) {
    const payload = concat([mdhd, hdlr, minf]);
    return box("mdia", payload);
}

/**
 * Build `trak`:
 *
 * trak
 *   tkhd
 *   mdia
 */
function buildTrakBox(tkhd, mdia) {
    const payload = concat([tkhd, mdia]);
    return box("trak", payload);
}

/**
 * Build the full `moov` box.
 *
 * moov
 *   mvhd
 *   trak
 */
export function buildMoovBox({
    mvhd,
    tkhd,
    mdhd,
    hdlr,
    vmhd,
    dref,
    stsd,
    stts,
    stsc,
    stsz,
    stco,
}) {

    console.log("MOOV INPUT VALIDATION START");
    console.log("BUILD_MOOV ENTRY STSZ:");
    console.log("  stsz len =", stsz.length);
    console.log("  stsz header =", Array.from(stsz.slice(0, 16)));
    for (const [name, box] of Object.entries({ stsd, stts, stsc, stsz, stco })) {
        const size = (box[0]<<24)|(box[1]<<16)|(box[2]<<8)|box[3];
        const type = String.fromCharCode(box[4], box[5], box[6], box[7]);
        console.log("  ", name, "size =", size, "type =", type);
        console.log("    first 16 =", Array.from(box.slice(0,16)));
    }
    console.log("MOOV INPUT VALIDATION END");

    // Compose inner structures bottom-up
    const minf = buildMinfBox(vmhd, dref, stsd, stts, stsc, stsz, stco);

    console.log("MOOV: MINF BOX SIZE =", (minf[0]<<24)|(minf[1]<<16)|(minf[2]<<8)|minf[3]);
    console.log("MOOV: MINF FIRST 32 =", Array.from(minf.slice(0,32)));

    const mdia = buildMdiaBox(mdhd, hdlr, minf);
    const trak = buildTrakBox(tkhd, mdia);

    console.log("MOOV: TRAK BOX SIZE =", (trak[0]<<24)|(trak[1]<<16)|(trak[2]<<8)|trak[3]);

    // moov = mvhd + trak
    const payload = concat([mvhd, trak]);
    const moov = box("moov", payload);
    console.log("MOOV FINAL SIZE =", (moov[0]<<24)|(moov[1]<<16)|(moov[2]<<8)|moov[3]);
    console.log("MOOV FINAL FIRST 32 =", Array.from(moov.slice(0,32)));
    return moov;    
}
