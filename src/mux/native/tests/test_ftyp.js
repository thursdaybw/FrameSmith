import { readUint32FromMp4BoxBytes, readBoxTypeFromMp4BoxBytes } from "./testUtils.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { buildFtypBox } from "../boxes/ftypBox.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

export async function testFtyp_Structure() {
    console.log("=== testFtyp_Structure ===");

    const node = buildFtypBox();
    const ftyp = serializeBoxTree(node);

    // ---- Header --------------------------------------------------------------
    assertEqual(
        "ftyp.size",
        readUint32FromMp4BoxBytes(ftyp, 0),
        ftyp.length
    );

    assertEqual(
        "ftyp.type",
        readBoxTypeFromMp4BoxBytes(ftyp, 4),
        "ftyp"
    );

    // ---- major_brand ---------------------------------------------------------
    assertEqual(
        "ftyp.major_brand",
        readBoxTypeFromMp4BoxBytes(ftyp, 8),
        "isom"
    );

    // ---- minor_version -------------------------------------------------------
    assertEqual(
        "ftyp.minor_version",
        readUint32FromMp4BoxBytes(ftyp, 12),
        512
    );

    // ---- compatible_brands ---------------------------------------------------
    const brands = [
        readBoxTypeFromMp4BoxBytes(ftyp, 16),
        readBoxTypeFromMp4BoxBytes(ftyp, 20),
        readBoxTypeFromMp4BoxBytes(ftyp, 24),
        readBoxTypeFromMp4BoxBytes(ftyp, 28),
    ];

    const expectedBrands = ["isom", "iso2", "avc1", "mp41"];

    for (let i = 0; i < expectedBrands.length; i++) {
        assertEqual(
            `ftyp.compatible_brands[${i}]`,
            brands[i],
            expectedBrands[i]
        );
    }

    console.log("PASS: ftyp structural correctness");
}

export async function testFtyp_Conformance() {
    console.log("=== testFtyp_Conformance (golden MP4) ===");

    // 1. Load reference MP4
    const resp = await fetch("reference/reference_visual.mp4");
    const buf = new Uint8Array(await resp.arrayBuffer());

    // 2. Extract reference ftyp
    const refFtyp = extractBoxByPath(buf, ["ftyp"]);

    // 3. Build Framesmith ftyp
    const outFtyp = serializeBoxTree(buildFtypBox());

    // 4. Parse both
    const ref = parseFtyp(refFtyp);
    const out = parseFtyp(outFtyp);

    // ---- Reference sanity ----------------------------------------------------
    assertEqual("ftyp.ref.type", ref.type, "ftyp");
    assertEqual("ftyp.out.type", out.type, "ftyp");

    // ---- Field-level conformance ---------------------------------------------
    assertEqual("ftyp.major_brand",  out.majorBrand,  ref.majorBrand);
    assertEqual("ftyp.minor_version", out.minorVersion, ref.minorVersion);

    assertEqual(
        "ftyp.compatible_brands.length",
        out.compatibleBrands.length,
        ref.compatibleBrands.length
    );

    for (let i = 0; i < ref.compatibleBrands.length; i++) {
        assertEqual(
            `ftyp.compatible_brands[${i}]`,
            out.compatibleBrands[i],
            ref.compatibleBrands[i]
        );
    }

    // ---- Absolute byte-for-byte ----------------------------------------------
    assertEqual(
        "ftyp.size",
        outFtyp.length,
        refFtyp.length
    );

    for (let i = 0; i < refFtyp.length; i++) {
        assertEqual(
            `ftyp.byte[${i}]`,
            outFtyp[i],
            refFtyp[i]
        );
    }

    console.log("PASS: ftyp matches golden MP4 byte-for-byte");
}

// -----------------------------------------------------------------------------
// Shared parser for semantic comparison
// -----------------------------------------------------------------------------
function parseFtyp(box) {
    const size = readUint32FromMp4BoxBytes(box, 0);
    const type = readBoxTypeFromMp4BoxBytes(box, 4);

    const majorBrand = readBoxTypeFromMp4BoxBytes(box, 8);
    const minorVersion = readUint32FromMp4BoxBytes(box, 12);

    const compatibleBrands = [];
    for (let offset = 16; offset + 4 <= size; offset += 4) {
        compatibleBrands.push(readBoxTypeFromMp4BoxBytes(box, offset));
    }

    return {
        size,
        type,
        majorBrand,
        minorVersion,
        compatibleBrands
    };
}
