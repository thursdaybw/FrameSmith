import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * Build a minimal, widely compatible MP4 ftyp box.
 *
 * Layout (32 bytes total):
 *
 *   size (4)
 *   type 'ftyp' (4)
 *
 *   major_brand:      'isom' (4)
 *   minor_version:    0      (4)
 *
 *   compatible_brands:
 *       'isom' (4)
 *       'iso2' (4)
 *       'avc1' (4)
 *       'mp41' (4)
 *
 * This matches the expectations in test_ftyp.js.
 */
export function buildFtypBox() {
    const out = new Uint8Array(32);

    // Total size
    writeUint32(out, 0, 32);

    // Type
    writeString(out, 4, "ftyp");

    // major_brand = 'isom'
    writeString(out, 8, "isom");

    // minor_version = 0
    writeUint32(out, 12, 0);

    // compatible_brands
    writeString(out, 16, "isom");
    writeString(out, 20, "iso2");
    writeString(out, 24, "avc1");
    writeString(out, 28, "mp41");

    return out;
}
