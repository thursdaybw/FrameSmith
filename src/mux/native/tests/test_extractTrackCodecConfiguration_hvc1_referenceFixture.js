import { extractTrackCodecConfigurationFromMp4 } from "../demux/container/extractTrackCodecConfigurationFromMp4.js";
import { assertEqual } from "./assertions.js";

export async function test_extractTrackCodecConfiguration_hvc1_referenceFixture() {
    const resp = await fetch("reference/reference_hevc.mp4");
    if (!resp.ok) {
        throw new Error(
            "test_extractTrackCodecConfiguration_hvc1_referenceFixture: missing oracle " +
            "reference/reference_hevc.mp4. Generate it using instructions in " +
            "src/mux/native/tests/reference/README.md"
        );
    }

    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());
    const codecConfig = extractTrackCodecConfigurationFromMp4({
        mp4Bytes,
        zeroBasedTrackIndex: 0
    });

    const isHevc = codecConfig.codec === "hvc1" || codecConfig.codec === "hev1";
    assertEqual("hevc sample entry codec", isHevc, true);
    assertEqual("hvcC present", codecConfig.hvcC instanceof Uint8Array, true);
    assertEqual("hvcC non-empty", codecConfig.hvcC.length > 0, true);
}
