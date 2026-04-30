import { readUint32 } from "../bytes/mp4ByteReader.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    assertEqual,
    assertExists
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";

export async function testFtyp_Structure() {

    const node =
        EmitterRegistry.emit(
            "ftyp"
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual(
        "ftyp.type",
        node.type,
        "ftyp"
    );

    // ---------------------------------------------------------
    // Body presence
    // ---------------------------------------------------------
    assertExists(
        "ftyp.body",
        node.body
    );

    // ---------------------------------------------------------
    // major_brand
    // ---------------------------------------------------------
    assertEqual(
        "ftyp.major_brand",
        node.body[0].type,
        "isom"
    );

    // ---------------------------------------------------------
    // minor_version
    // ---------------------------------------------------------
    assertEqual(
        "ftyp.minor_version",
        node.body[1].int,
        512
    );

    // ---------------------------------------------------------
    // compatible_brands (FLAT, POSITIONAL)
    // ---------------------------------------------------------
    const brands =
        node.body
            .slice(2)
            .map(field => field.type);

    const expectedBrands = [
        "isom",
        "iso2",
        "avc1",
        "mp41"
    ];

    assertEqual(
        "ftyp.compatible_brands.count",
        brands.length,
        expectedBrands.length
    );

    for (let i = 0; i < expectedBrands.length; i++) {
        assertEqual(
            `ftyp.compatible_brands[${i}]`,
            brands[i],
            expectedBrands[i]
        );
    }
}

export async function testFtyp_LockedLayoutEquivalence_ffmpeg() {

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Read reference FTYP via golden truth
    // -------------------------------------------------------------
    const ref =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "ftyp"
        );

    const refReport = ref.readBoxReport();
    const params    = ref.getEmitterInput();

    // -------------------------------------------------------------
    // 3. Rebuild FTYP via EmitterRegistry
    // -------------------------------------------------------------
    const node =
        EmitterRegistry.emit(
            "ftyp",
            params
        );

    const outBytes =
        serializeBoxTree(node);

    // -------------------------------------------------------------
    // 4. Read rebuilt FTYP via extractor
    // -------------------------------------------------------------
    const outReport = GoldenTruthRegistry
        .getExtractor("ftyp")
        .readBoxReport(outBytes);

    // -------------------------------------------------------------
    // 5. Field-level conformance (FLAT)
    // -------------------------------------------------------------
    assertEqual(
        "ftyp.type",
        outReport.box.type,
        refReport.box.type
    );

    assertEqual(
        "ftyp.majorBrand",
        outReport.box.fields.majorBrand,
        refReport.box.fields.majorBrand
    );

    assertEqual(
        "ftyp.minorVersion",
        outReport.box.fields.minorVersion,
        refReport.box.fields.minorVersion
    );

    let i = 0;
    while (`compatibleBrand${i}` in refReport.box.fields) {
        assertEqual(
            `ftyp.compatibleBrand${i}`,
            outReport.box.fields[`compatibleBrand${i}`],
            refReport.box.fields[`compatibleBrand${i}`]
        );
        i++;
    }

    // -------------------------------------------------------------
    // 6. Byte-for-byte equivalence
    // -------------------------------------------------------------
    const refRaw = refReport.raw;

    assertEqual(
        "ftyp.size",
        outBytes.length,
        refRaw.length
    );

    for (let b = 0; b < refRaw.length; b++) {
        assertEqual(
            `ftyp.byte[${b}]`,
            outBytes[b],
            refRaw[b]
        );
    }
}
