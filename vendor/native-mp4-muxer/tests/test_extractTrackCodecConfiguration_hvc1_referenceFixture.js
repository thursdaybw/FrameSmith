import { extractTrackCodecConfigurationFromMp4 } from "../demux/container/extractTrackCodecConfigurationFromMp4.js";
import { assertEqual, assertExists } from "./assertions.js";

export async function test_extractTrackCodecConfiguration_hvc1_referenceFixture() {

    const resp = await fetch("reference/reference_hevc.mp4");
    if (!resp.ok) {
        throw new Error(
            "test_extractTrackCodecConfiguration_hvc1_referenceFixture: missing oracle " +
            "reference/reference_hevc.mp4. Generate it using instructions in " +
            "tests/reference/README.md"
        );
    }

    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const codecConfig = extractTrackCodecConfigurationFromMp4({
        mp4Bytes,
        zeroBasedTrackIndex: 0
    });

    const isHevc =
        codecConfig.codec === "hvc1" ||
        codecConfig.codec === "hev1";

    assertEqual("hevc sample entry codec", isHevc, true);

    assertExists("hvc1 codecConfig.config", codecConfig.config);

    assertEqual(
        "hvc1 representation is container",
        codecConfig.config.representation,
        "container"
    );

    assertEqual(
        "hvc1 config bytes is Uint8Array",
        codecConfig.config.bytes instanceof Uint8Array,
        true
    );

    assertEqual(
        "hvc1 config bytes non-empty",
        codecConfig.config.bytes.length > 0,
        true
    );

    // Legacy must not exist
    assertEqual("no legacy hvcC field", codecConfig.hvcC, undefined);
}
