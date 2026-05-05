import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { buildUdtaIntentFromBuildHints } from "../builders/buildUdtaIntentFromBuildHints.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertEqual, assertObjectEqual } from "./assertions.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export async function testNativeMuxer_UDTA_BuildIntent_FromGoldenClient_EqualsOracle() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });
    const udtaIntent = buildUdtaIntentFromBuildHints({ buildHints: mp4CompilerState.buildHints });

    // ---------------------------------------------------------
    // Oracle comparison
    // ---------------------------------------------------------
    const oracleUdtaIntent = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/udta"
            ).getEmitterInput()

    assertObjectEqual( "udta intent", udtaIntent, oracleUdtaIntent);

    // ---------------------------------------------------------
    // Build compiler udta bytes
    // ---------------------------------------------------------
    const compilerUdtaBytes = serializeBoxTree(EmitterRegistry.assemble("moov/udta", udtaIntent));

    // ---------------------------------------------------------
    // Extract oracle udta bytes
    // ---------------------------------------------------------
    const oracleUdtaBytes = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/udta"
            ).readBoxReport().raw;

    // ---------------------------------------------------------
    // Byte-for-byte assertion
    // ---------------------------------------------------------
    for (let i = 0; i < compilerUdtaBytes.length; i++) {
        if (compilerUdtaBytes[i] !== oracleUdtaBytes[i]) {
            throw new Error(
                `udta byte mismatch at offset ${i}\n` +
                `expected 0x${oracleUdtaBytes[i].toString(16)}\n` +
                `actual   0x${compilerUdtaBytes[i].toString(16)}`
            );
        }
    }

    assertEqual( "udta byte length", compilerUdtaBytes.length, oracleUdtaBytes.length);
}
