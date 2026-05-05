import { assertExists, assertEqual } from "./assertions.js";
import { buildUdtaIntentFromBuildHints } from "../builders/buildUdtaIntentFromBuildHints.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export function test_BuildUdtaIntent_DefaultEncoderIdentity() {

    const udtaIntent = buildUdtaIntentFromBuildHints({ buildHints: {} });

    assertExists( "default udta intent", udtaIntent);

    const udtaNode = EmitterRegistry.assemble( "moov/udta", udtaIntent);

    assertEqual( "udta.type", udtaNode.type, "udta");
    assertEqual( "udta has children", Array.isArray(udtaNode.children), true);
    assertEqual( "udta child count", udtaNode.children.length, 1);
    assertEqual( "udta child is meta", udtaNode.children[0].type, "meta");
}
