import { assertEqual, assertThrows } from "./assertions.js";
import {
    adaptAudioCodecConfigurationToStsdParams
} from "../adapters/adaptAudioCodecConfigurationToStsdParams.js";

export function test_adaptAudioCodecConfigurationToStsdParams_mp4a() {

    const esds = new Uint8Array([0x01, 0x02, 0x03]);

    const out =
        adaptAudioCodecConfigurationToStsdParams({
            codec: "mp4a.40.2",
            esds
        });

    assertEqual(
        "audio stsd codec",
        out.codec,
        "mp4a"
    );

    assertEqual(
        "audio stsd esds passthrough",
        out.esds,
        esds
    );
}
