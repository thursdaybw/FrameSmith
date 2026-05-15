import {
    createPipelineOptions,
    createTranscriptionOptions
} from "./TransformersBrowserWhisperRuntime.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export function test_createPipelineOptions_usesWebGpuQ4() {
    const options = createPipelineOptions({ device: "webgpu" });

    assert(options.device === "webgpu", "WebGPU pipeline must opt into WebGPU device");
    assert(options.dtype === "q4", "WebGPU pipeline must use q4 from the proven spike path");
}

export function test_createPipelineOptions_usesWasmFp32WithoutDevice() {
    const options = createPipelineOptions({ device: "wasm" });

    assert(!Object.prototype.hasOwnProperty.call(options, "device"), "WASM path must omit device and use browser default");
    assert(options.dtype === "fp32", "WASM path must use fp32 to avoid broken quantized graph");
}

export function test_createTranscriptionOptions_requestsWordTimestamps() {
    const options = createTranscriptionOptions({ timestampMode: "word" });

    assert(options.return_timestamps === "word", "word mode must request word timestamps");
    assert(options.chunk_length_s === 30, "chunk length must match spike path");
    assert(options.stride_length_s === 5, "stride length must match spike path");
}

export const TRANSFORMERS_BROWSER_WHISPER_RUNTIME_TESTS = [
    test_createPipelineOptions_usesWebGpuQ4,
    test_createPipelineOptions_usesWasmFp32WithoutDevice,
    test_createTranscriptionOptions_requestsWordTimestamps
];
