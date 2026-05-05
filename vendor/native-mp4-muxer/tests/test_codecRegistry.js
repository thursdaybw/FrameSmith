import { assertEqual } from "./assertions.js";
import {
    getCodecProfileByCodecName,
    getCodecProfileBySampleEntryType,
    validateCodecConfigShapeForProfile
} from "../codecs/codecRegistry.js";

export async function test_codecRegistry_ResolvesProfilesByCodecAndSampleEntry() {
    const avcProfile = getCodecProfileByCodecName("avc1.640028");
    assertEqual("avc1 profile resolves", avcProfile?.id, "avc1");

    const hevcProfile = getCodecProfileBySampleEntryType("hev1");
    assertEqual("hev1 sample entry resolves to hvc1 profile", hevcProfile?.id, "hvc1");

    const opusProfile = getCodecProfileBySampleEntryType("Opus");
    assertEqual("Opus sample entry resolves case-insensitive", opusProfile?.id, "opus");
}

export async function test_codecRegistry_ConfigShapeValidation_RejectsForeignKeys() {
    const avcProfile = getCodecProfileByCodecName("avc1");

    let threw = false;
    try {
        validateCodecConfigShapeForProfile({
            codecConfig: {
                codec: "avc1",
                avcC: new Uint8Array([1, 2, 3, 4]),
                esds: new Uint8Array([5, 6])
            },
            profile: avcProfile,
            callerLabel: "test_codecRegistry_ConfigShapeValidation_RejectsForeignKeys"
        });
    } catch (error) {
        threw = String(error?.message ?? error).includes("foreign config key 'esds'");
    }
    assertEqual("avc1 rejects foreign esds", threw, true);
}

export async function test_codecRegistry_ConfigShapeValidation_RequiresOwnedKey() {
    const mp4aProfile = getCodecProfileByCodecName("mp4a.40.2");

    let threw = false;
    try {
        validateCodecConfigShapeForProfile({
            codecConfig: {
                codec: "mp4a",
                channelCount: 2,
                sampleRate: 48000
            },
            profile: mp4aProfile,
            callerLabel: "test_codecRegistry_ConfigShapeValidation_RequiresOwnedKey"
        });
    } catch (error) {
        threw = String(error?.message ?? error).includes("missing required config key 'esds'");
    }
    assertEqual("mp4a requires esds", threw, true);
}

