/**
 * AudioEncoder Capability Probe
 * =============================
 *
 * PURPOSE
 * -------
 * Queries browser support for AudioEncoder configurations
 * WITHOUT encoding any audio.
 *
 * This probe answers:
 * - Which codecs are accepted?
 * - Which channel counts are accepted?
 * - Which sample rates are accepted?
 *
 * This is authoritative ground truth for Framesmith audio encoding.
 *
 * This file:
 * - does NOT encode
 * - does NOT construct AudioData
 * - does NOT involve the muxer
 */

export async function runAudioEncoderCapabilityProbe() {
    console.log("=== AudioEncoder Capability Probe ===");

    if (!window.AudioEncoder) {
        console.log("AudioEncoder NOT available");
        return;
    }

    const candidateConfigs = [
        {
            name: "AAC (generic)",
            config: {
                codec: "aac",
                sampleRate: 48000,
                numberOfChannels: 2,
                bitrate: 128000
            }
        },
        {
            name: "AAC LC (mp4a.40.2)",
            config: {
                codec: "mp4a.40.2",
                sampleRate: 48000,
                numberOfChannels: 2,
                bitrate: 128000
            }
        },
        {
            name: "AAC LC mono",
            config: {
                codec: "mp4a.40.2",
                sampleRate: 48000,
                numberOfChannels: 1,
                bitrate: 64000
            }
        },
        {
            name: "Opus stereo",
            config: {
                codec: "opus",
                sampleRate: 48000,
                numberOfChannels: 2,
                bitrate: 128000
            }
        },
        {
            name: "Opus mono",
            config: {
                codec: "opus",
                sampleRate: 48000,
                numberOfChannels: 1,
                bitrate: 64000
            }
        }
    ];

    for (const { name, config } of candidateConfigs) {
        try {
            const result =
                await AudioEncoder.isConfigSupported(config);

            if (result.supported) {
                console.log("SUPPORTED:", name, result.config);
            } else {
                console.log("REJECTED:", name, result);
            }
        } catch (err) {
            console.log("ERROR:", name, err);
        }
    }

    console.log("=== AudioEncoder Capability Probe DONE ===");
}
