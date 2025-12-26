import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitFtypBox } from "../box-emitters/ftypBox.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testFtyp_Structure() {
    console.log("=== testFtyp_Structure ===");

    const node = emitFtypBox();
    const ftyp = serializeBoxTree(node);

    // ---- Header --------------------------------------------------------------
    assertEqual(
        "ftyp.size",
        readUint32(ftyp, 0),
        ftyp.length
    );

    assertEqual(
        "ftyp.type",
        readFourCC(ftyp, 4),
        "ftyp"
    );

    // ---- major_brand ---------------------------------------------------------
    assertEqual(
        "ftyp.major_brand",
        readFourCC(ftyp, 8),
        "isom"
    );

    // ---- minor_version -------------------------------------------------------
    assertEqual(
        "ftyp.minor_version",
        readUint32(ftyp, 12),
        512
    );

    // ---- compatible_brands ---------------------------------------------------
    const brands = [
        readFourCC(ftyp, 16),
        readFourCC(ftyp, 20),
        readFourCC(ftyp, 24),
        readFourCC(ftyp, 28),
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

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Read reference FTYP via parser registry
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.fromMp4(
        mp4,
        "ftyp"
    );

    const refFields = ref.readFields();
    const params    = ref.getBuilderInput();

    // -------------------------------------------------------------
    // 3. Rebuild FTYP using Framesmith builder
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitFtypBox(params)
    );

    // -------------------------------------------------------------
    // 4. Read rebuilt FTYP via same parser
    // -------------------------------------------------------------
    const out = getGoldenTruthBox.fromBox(
        outBytes,
        "ftyp"
    ).readFields();

    // -------------------------------------------------------------
    // 5. Field-level conformance
    // -------------------------------------------------------------
    assertEqual("ftyp.type", out.type, refFields.type);
    assertEqual("ftyp.major_brand", out.majorBrand, refFields.majorBrand);
    assertEqual("ftyp.minor_version", out.minorVersion, refFields.minorVersion);

    assertEqual(
        "ftyp.compatible_brands.length",
        out.compatibleBrands.length,
        refFields.compatibleBrands.length
    );

    for (let i = 0; i < refFields.compatibleBrands.length; i++) {
        assertEqual(
            `ftyp.compatible_brands[${i}]`,
            out.compatibleBrands[i],
            refFields.compatibleBrands[i]
        );
    }

    // -------------------------------------------------------------
    // 6. Byte-for-byte equivalence
    // -------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "ftyp.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `ftyp.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: ftyp matches golden MP4 byte-for-byte");
}

