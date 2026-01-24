import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";
import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js";
import { assertEqualHex, assertEqual } from "./assertions.js";

import { assembleMdatPayloadFromChunks } from "../assembleMdatPayloadFromChunks.js";

import { extractAccessUnitPayloadsFromMp4 }
    from "./reference/extractAccessUnitPayloadsFromMp4.js";

export async function testNativeMuxer_MdatAssembly_FromChunkModel() {

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract semantic samples (oracle)
    // ---------------------------------------------------------
    const samples = extractSemanticAccessUnitsFromMp4({
        mp4Bytes: mp4
    });

    assertEqual(
        "sample.count > 0",
        samples.length > 0,
        true
    );

    // ---------------------------------------------------------
    // 3. Derive access unit groups (semantic intent)
    // ---------------------------------------------------------
    const accessUnitGroups = deriveChunkModel(
        samples,
        ChunkingStrategies.ALL_SAMPLES_ONE_CHUNK
    );

    assertEqual(
        "group.count",
        accessUnitGroups.length,
        1
    );

    // ---------------------------------------------------------
    // 4. Access unit payloads (byte-preserving)
    // ---------------------------------------------------------
    const accessUnitPayloads =
        extractAccessUnitPayloadsFromMp4({ mp4Bytes: mp4 });

    // ---------------------------------------------------------
    // 5. Assemble mdat payload from groups + payloads
    // ---------------------------------------------------------
    const {
        payload,
        chunkOffsets,
        chunkByteLengths
    } = assembleMdatPayloadFromChunks({
        accessUnitGroups,
        accessUnitPayloads
    });

    // ---------------------------------------------------------
    // A. Total coverage
    // ---------------------------------------------------------
    const expectedTotalBytes =
        chunkByteLengths.reduce((n, len) => n + len, 0);

    assertEqual(
        "mdat.totalByteLength",
        payload.length,
        expectedTotalBytes
    );

    // ---------------------------------------------------------
    // B. Global byte preservation
    // ---------------------------------------------------------
    let cursor = 0;

    for (let i = 0; i < accessUnitPayloads.length; i++) {
        const bytes = accessUnitPayloads[i];

        for (let j = 0; j < bytes.length; j++) {
            assertEqualHex(
                `mdat.global.byte[${cursor + j}]`,
                payload[cursor + j],
                bytes[j]
            );
        }

        cursor += bytes.length;
    }

    assertEqual(
        "mdat.global.cursor.final",
        cursor,
        payload.length
    );

    // ---------------------------------------------------------
    // C. Group integrity
    // ---------------------------------------------------------
    assertEqual(
        "chunkOffsets.length",
        chunkOffsets.length,
        accessUnitGroups.length
    );

    assertEqual(
        "chunkByteLengths.length",
        chunkByteLengths.length,
        accessUnitGroups.length
    );

    for (let i = 0; i < accessUnitGroups.length; i++) {

        const group = accessUnitGroups[i];
        const offset = chunkOffsets[i];
        const length = chunkByteLengths[i];

        let expectedGroupCursor = 0;

        for (const { sampleIndex } of group.samples) {
            const bytes = accessUnitPayloads[sampleIndex];

            for (let j = 0; j < bytes.length; j++) {
                assertEqualHex(
                    `mdat.group[${i}].byte[${expectedGroupCursor + j}]`,
                    payload[offset + expectedGroupCursor + j],
                    bytes[j]
                );
            }

            expectedGroupCursor += bytes.length;
        }

        assertEqual(
            `mdat.group[${i}].byteLength`,
            expectedGroupCursor,
            length
        );
    }

    // ---------------------------------------------------------
    // D. Offset monotonicity
    // ---------------------------------------------------------
    assertEqual(
        "chunkOffsets[0]",
        chunkOffsets[0],
        0
    );

    for (let i = 1; i < chunkOffsets.length; i++) {
        assertEqual(
            `chunkOffsets[${i}]`,
            chunkOffsets[i],
            chunkOffsets[i - 1] + chunkByteLengths[i - 1]
        );
    }

}
