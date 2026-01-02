import { adaptCodecConfigurationToStsdParams }
    from "../../adapters/adaptCodecConfigurationToStsdParams.js";

export function test_adaptCodecConfigurationToStsdParams() {
    console.log("=== test_adaptCodecConfigurationToStsdParams ===");

    // -----------------------------------------------------
    // Case 1 — RFC 6381 avc1 string maps to MP4 sample entry
    // -----------------------------------------------------
    const result = adaptCodecConfigurationToStsdParams({
        codec: "avc1.42E01E",
        width: 640,
        height: 360,
        compressorName: "WebCodecs",
        avcC: new Uint8Array([1, 2, 3])
    });

    if (result.codec !== "avc1") {
        throw new Error(
            `FAIL: expected codec 'avc1', got '${result.codec}'`
        );
    }

    if (!(result.avcC instanceof Uint8Array)) {
        throw new Error(
            "FAIL: avcC not preserved as Uint8Array"
        );
    }

    // -----------------------------------------------------
    // Case 2 — Unsupported codec is rejected loudly
    // -----------------------------------------------------
    let threw = false;

    try {
        adaptCodecConfigurationToStsdParams({
            codec: "vp09.00.10.08",
            width: 640,
            height: 360,
            compressorName: "WebCodecs",
            avcC: new Uint8Array([1])
        });
    } catch {
        threw = true;
    }

    if (!threw) {
        throw new Error(
            "FAIL: unsupported codec was accepted"
        );
    }

    console.log("PASS: adaptCodecConfigurationToStsdParams");
}
