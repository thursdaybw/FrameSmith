/*}*
 * Integration tests for NativeMuxer:
 *
 * 1. Annex-B ingestion:
 *      Encoder embeds SPS/PPS in encoded samples.
 *      NativeMuxer must extract SPS/PPS from those samples.
 *
 * 2. avcC ingestion:
 *      Encoder does NOT embed SPS/PPS.
 *      SPS/PPS are supplied through setCodecConfigurationRecord().
 *      NativeMuxer must consume avcC and mux successfully.
 */

import { NativeMuxer } from "../../NativeMuxer.js";
import { readType, readUint32, writeDebugAvcC } from "../../tests/testUtils.js";

import { createFrames } from "../support/createFrames.js";
import { encodeFrames } from "../support/encodeFrames.js";

function downloadDebugMp4(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
}

function assertBasicMp4Structure(buffer) {
    if (readType(buffer, 4) !== "ftyp") {
        throw new Error("FAIL: missing ftyp");
    }
    const ftypLen = readUint32(buffer, 0);
    if (readType(buffer, ftypLen + 4) !== "moov") {
        throw new Error("FAIL: missing moov");
    }
}

function environmentSupportsAnnexBSPSPPS() {
    const config = {
        codec: "avc1.42E01E",
        width: 64,
        height: 64,
        bitrate: 200000,
        framerate: 30,
        avc: { format: "annexb" }
    };

    return VideoEncoder.isConfigSupported(config)
        .then(s => !!s.config.description)    // description contains SPS/PPS
        .catch(() => false);
}


/* -----------------------------------------------------------
   TEST 1: ANNEX-B INGESTION
----------------------------------------------------------- */
export async function test_NativeMuxer_integration_annexb_environmental() {

    console.log("=== test_NativeMuxer_integration_annexb ===");

    const width = 64, height = 64;

    // Create test frames
    const frames = await createFrames(width, height);

    // Encode frames
    const chunks = await encodeFrames(frames, {
        codec: "avc1.42E01E",
        width,
        height,
        bitrate: 200000,
        framerate: 30,
        avc: { format: "annexb" }
    });

    if (chunks.length === 0) {
        throw new Error("FAIL: encoder returned no chunks");
    }

    // SPS/PPS detection by inspecting real chunk payload
    const firstChunk = chunks[0];
    const tmp = new Uint8Array(firstChunk.byteLength);
    await firstChunk.copyTo(tmp);

    const hasSps = tmp.includes(0x67);  // NAL type 7
    const hasPps = tmp.includes(0x68);  // NAL type 8

    if (!hasSps || !hasPps) {
        console.warn("SKIP: SPS/PPS not embedded in Annex-B in this environment");
        return;
    }

    // Now run muxer normally
    const muxer = new NativeMuxer({ codec: "avc1.42E01E", width, height, fps: 30 });

    for (const c of chunks) muxer.addVideoFrame(c);

    const blob = await muxer.finalize();
    if (!(blob instanceof Blob)) throw new Error("FAIL: finalize() did not return Blob");

    const buffer = new Uint8Array(await blob.arrayBuffer());
    assertBasicMp4Structure(buffer);

    downloadDebugMp4(blob, "native_muxer_annexb_test.mp4");

    console.log("PASS: annexb ingestion");
}


/* -----------------------------------------------------------
   TEST 2: avcC INGESTION
----------------------------------------------------------- */
export async function test_NativeMuxer_integration_avcc() {
    console.log("=== test_NativeMuxer_integration_avcc ===");

    const width = 64, height = 64;

    const frames = await createFrames(width, height);

    const chunks = await encodeFrames(frames, {
        codec: "avc1.42E01E",
        width,
        height,
        bitrate: 200000,
        framerate: 30,
        avc: { format: "annexb" } 
        
    });

    if (chunks.length === 0) throw new Error("FAIL: encoder returned no chunks");

    // Obtain real avcC from WebCodecs support check
    const support = await VideoEncoder.isConfigSupported({
        codec: "avc1.42E01E",
        width,
        height
    });

    // Extract avcC from support, but skip test if not provided
    const rawDesc = support.config.description;
    const avcC = rawDesc ? new Uint8Array(rawDesc) : new Uint8Array();

    if (avcC.length === 0) {
        console.warn("SKIP: Environment does not provide avcC via config.description");
        return;
    }

    const muxer = new NativeMuxer({ codec: "avc1.42E01E", width, height, fps: 30 });


    // inject this avcC into the muxer
    muxer.setCodecConfigurationRecord(avcC);

    for (const c of chunks) muxer.addVideoFrame(c);

    const blob = await muxer.finalize();
    if (!(blob instanceof Blob)) throw new Error("FAIL: finalize() did not return Blob");

    const buffer = new Uint8Array(await blob.arrayBuffer());

    const extractedAvcC = writeDebugAvcC(buffer);

    if (!extractedAvcC) throw new Error("FAIL: avcC not found");


    if (extractedAvcC.length !== avcC.length) {
        throw new Error(
            `FAIL: avcC length mismatch. Expected ${avcC.length}, got ${extractedAvcC.length}`
        );
    }

    for (let i = 0; i < avcC.length; i++) {
        if (extractedAvcC[i] !== avcC[i]) {
            throw new Error(
                `FAIL: avcC byte mismatch at index ${i}. Expected ${avcC[i]}, got ${extractedAvcC[i]}`
            );
        }
    }

    console.log("PASS: avcC payload matches expected input");

    assertBasicMp4Structure(buffer);

    downloadDebugMp4(blob, "native_muxer_avcc_test.mp4");

    console.log("PASS: avcC ingestion");
}
