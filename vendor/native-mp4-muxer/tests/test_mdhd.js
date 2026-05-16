import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readUint16 } from "../bytes/mp4ByteReader.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { assertEqual, assertExists } from "./assertions.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";

export async function testMdhd_Structure() {

    const timescale = 90000;
    const duration  = 90000 * 5;

    const node =
        EmitterRegistry.emit(
            "moov/trak/mdia/mdhd",
            { timescale, duration }
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("mdhd.type", node.type, "mdhd");
    assertEqual("mdhd.version", node.version, 0);
    assertEqual("mdhd.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body structure
    // ---------------------------------------------------------
    assertExists("mdhd.body", node.body);
    assertEqual("mdhd.body.length", node.body.length, 6);

    // creation_time
    assertEqual("mdhd.creation_time", node.body[0].int, 0);

    // modification_time
    assertEqual("mdhd.modification_time", node.body[1].int, 0);

    // timescale
    assertEqual("mdhd.timescale", node.body[2].int, timescale);

    // duration
    assertEqual("mdhd.duration", node.body[3].int, duration);

    // language ("und")
    assertEqual("mdhd.language", node.body[4].short, 0x55c4);

    // predefined
    assertEqual("mdhd.predefined", node.body[5].short, 0);
}


export async function testMdhd_Conformance() {

    // -------------------------------------------------------------
    // Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // Read reference MDHD via golden truth
    // -------------------------------------------------------------
    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/mdhd"
    );

    const refReport = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    // -------------------------------------------------------------
    // Rebuild MDHD via emitter registry
    // -------------------------------------------------------------
    const outBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/mdhd",
                params
            )
        );

    // -------------------------------------------------------------
    // Read rebuilt MDHD via same extractor
    // -------------------------------------------------------------
    const outReport = GoldenTruthRegistry
        .getExtractor("moov/trak/mdia/mdhd")
        .readBoxReport(outBytes);

    // -------------------------------------------------------------
    // Field-level conformance
    // -------------------------------------------------------------
    assertEqual("mdhd.version",   outReport.box.header.version, refReport.box.header.version);
    assertEqual("mdhd.flags",     outReport.box.header.flags,   refReport.box.header.flags);
    assertEqual("mdhd.timescale", outReport.box.fields.timescale, refReport.box.fields.timescale);
    assertEqual("mdhd.duration",  outReport.box.fields.duration,  refReport.box.fields.duration);
    assertEqual("mdhd.language",  outReport.box.fields.language,  refReport.box.fields.language);

    // -------------------------------------------------------------
    // Byte-for-byte conformance
    // -------------------------------------------------------------
    const refRaw = refReport.raw;

    assertEqual("mdhd.size", outBytes.length, refRaw.length);

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(`mdhd.byte[${i}]`, outBytes[i], refRaw[i]);
    }
}

export async function testMdhd_Conformance_Audio() {

    // -------------------------------------------------------------
    // Load golden MP4 (audio track)
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // Read reference MDHD via golden truth
    // -------------------------------------------------------------
    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/mdhd"
    );

    const refReport = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    // -------------------------------------------------------------
    // Rebuild MDHD via emitter registry
    // -------------------------------------------------------------
    const outBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/mdhd",
                params
            )
        );

    // -------------------------------------------------------------
    // Read rebuilt MDHD
    // -------------------------------------------------------------
    const outReport = GoldenTruthRegistry
        .getExtractor("moov/trak/mdia/mdhd")
        .readBoxReport(outBytes);

    // -------------------------------------------------------------
    // Field-level conformance
    // -------------------------------------------------------------
    assertEqual("mdhd.version",   outReport.box.header.version, refReport.box.header.version);
    assertEqual("mdhd.flags",     outReport.box.header.flags,   refReport.box.header.flags);
    assertEqual("mdhd.timescale", outReport.box.fields.timescale, refReport.box.fields.timescale);
    assertEqual("mdhd.duration",  outReport.box.fields.duration,  refReport.box.fields.duration);
    assertEqual("mdhd.language",  outReport.box.fields.language,  refReport.box.fields.language);

    // -------------------------------------------------------------
    // Byte-for-byte conformance
    // -------------------------------------------------------------
    const refRaw = refReport.raw;

    assertEqual("mdhd.size", outBytes.length, refRaw.length);

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(`mdhd.byte[${i}]`, outBytes[i], refRaw[i]);
    }
}
