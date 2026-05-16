import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual, assertEqualHex, skipTest } from "./assertions.js";
import { readFourCC } from "../box-schema/boxLayoutReaders.js";
import { readUint32, readUint64 } from "../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { loadCo64OracleTrack0BoxBytes } from "./co64OracleNodeLoader.js";

export async function testCo64_Structure() {
    let node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/co64",
        { chunkOffsets: [] }
    );

    assertEqual("co64.type (empty)", node.type, "co64");
    assertEqual("co64.version (empty)", node.version, 0);
    assertEqual("co64.flags (empty)", node.flags, 0);
    assertEqual("co64.entry_count (empty)", node.body[0].int, 0);
    assertEqual("co64.body.length (empty)", node.body.length, 2);

    node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/co64",
        { chunkOffsets: [1000] }
    );
    assertEqual("co64.entry_count (single)", node.body[0].int, 1);
    assertEqual("co64.offset[0] (single)", node.body[1].values[0], 1000);

    const offsetsMulti = [8, 4_294_967_296, 4_294_967_301];
    node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/co64",
        { chunkOffsets: offsetsMulti }
    );
    assertEqual("co64.entry_count (multiple)", node.body[0].int, 3);
    for (let i = 0; i < offsetsMulti.length; i++) {
        assertEqual(`co64.offset[${i}]`, node.body[1].values[i], offsetsMulti[i]);
    }

    const mutableOffsets = [12, 24, 36];
    node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/co64",
        { chunkOffsets: mutableOffsets }
    );
    mutableOffsets[0] = 999;
    assertEqual("co64.immutability", node.body[1].values[0], 12);
}

export async function testCo64_LockedLayoutEquivalence_ffmpeg() {
    if (typeof window !== "undefined") {
        skipTest(
            "node-only: co64 oracle is multi-GB; run via node harness"
        );
    }

    const co64Bytes = await loadCo64OracleTrack0BoxBytes();
    const truth = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: co64Bytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl/co64",
        targetBoxPath: "moov/trak/mdia/minf/stbl/co64"
    });

    const refReport = truth.readBoxReport();
    const params = truth.getEmitterInput();
    const refBytes = refReport.raw;

    const outBytes = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/co64",
            params
        )
    );

    assertEqual("co64.type", readFourCC(outBytes, 4), "co64");
    assertEqual("co64.version", outBytes[8], 0);
    const flags =
        (outBytes[9] << 16) |
        (outBytes[10] << 8) |
        outBytes[11];
    assertEqual("co64.flags", flags, 0);

    const refOffsets = refReport.box.fields.chunkOffsets;
    assertEqual("co64.entry_count", readUint32(outBytes, 12), refOffsets.length);

    let offset = 16;
    for (let i = 0; i < refOffsets.length; i++) {
        assertEqual(
            `co64.chunk_offset[${i}]`,
            readUint64(outBytes, offset),
            refOffsets[i]
        );
        offset += 8;
    }

    for (let i = 0; i < refBytes.length; i++) {
        assertEqualHex(`co64.byte[${i}]`, outBytes[i], refBytes[i]);
    }
    assertEqual("co64.size", outBytes.length, refBytes.length);
}
