import { assertEqual, assertThrows } from "./assertions.js";
import {
    adaptAudioCodecConfigurationToStsdParams
} from "../adapters/adaptAudioCodecConfigurationToStsdParams.js";

export function test_adaptAudioCodecConfigurationToStsdParams_mp4a() {

    console.warn(
        "See: testNativeMuxer_STSD_CompilerPath_Opus_Equals_FFmpegOracle\n" +
        "adaptAudioCodecConfigurationToStsdParams was overhauled for opus support"
    );

    const esds = new Uint8Array([0x01, 0x02, 0x03]);

    const out =
        adaptAudioCodecConfigurationToStsdParams({
            codecConfiguration: {
                codec: "mp4a.40.2",
                esds,
                channelCount: 2,
                sampleRate: 48000
            }
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

    assertEqual(
        "audio channelCount",
        out.channelCount,
        2
    );

    assertEqual(
        "audio sampleRate",
        out.sampleRate,
        48000
    );
}
