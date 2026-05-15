import { pipeline } from "./vendor/transformers/4.0.1/transformers.web.min.js";

const audioFileInput = document.getElementById("audioFileInput");
const modelSelect = document.getElementById("modelSelect");
const deviceSelect = document.getElementById("deviceSelect");
const timestampSelect = document.getElementById("timestampSelect");
const transcribeButton = document.getElementById("transcribeButton");
const audioPreview = document.getElementById("audioPreview");
const statusText = document.getElementById("statusText");
const capabilitySummary = document.getElementById("capabilitySummary");
const transcriptOutput = document.getElementById("transcriptOutput");
const chunkTableBody = document.getElementById("chunkTableBody");
const rawOutput = document.getElementById("rawOutput");

const transcriberCache = new Map();
let selectedAudioObjectUrl = null;

renderCapabilitySummary();

audioFileInput.addEventListener("change", handleAudioFileSelected);
transcribeButton.addEventListener("click", transcribeSelectedAudioFile);

function handleAudioFileSelected() {
    revokeSelectedAudioObjectUrl();

    const file = audioFileInput.files?.[0] || null;
    if (!file) {
        audioPreview.removeAttribute("src");
        transcribeButton.disabled = true;
        setStatus("Choose an audio file.");
        return;
    }

    selectedAudioObjectUrl = URL.createObjectURL(file);
    audioPreview.src = selectedAudioObjectUrl;
    transcribeButton.disabled = false;
    setStatus(`Ready: ${file.name} (${formatBytes(file.size)})`);
}

async function transcribeSelectedAudioFile() {
    const file = audioFileInput.files?.[0] || null;
    if (!file) {
        setStatus("Choose an audio file first.", true);
        return;
    }

    transcribeButton.disabled = true;
    clearOutputs();

    try {
        const model = modelSelect.value;
        const timestampMode = timestampSelect.value;
        const audioUrl = selectedAudioObjectUrl || URL.createObjectURL(file);

        const { transcriber, device } = await loadFirstAvailableTranscriber({
            model,
            selectedDevice: deviceSelect.value
        });

        const options = createTranscriptionOptions({
            timestampMode
        });

        setStatus("Transcribing locally...");
        const startedAt = performance.now();
        const result = await transcriber(audioUrl, options);
        const elapsedSeconds = (performance.now() - startedAt) / 1000;

        renderResult({
            result,
            elapsedSeconds,
            model,
            device,
            timestampMode
        });
        setStatus(`Done in ${elapsedSeconds.toFixed(1)}s.`);
    } catch (error) {
        console.error("[TranscriptionSpike] transcription failed", error);
        setStatus(`Failed: ${error?.message || String(error)}`, true);
        rawOutput.textContent = error?.stack || error?.message || String(error);
    } finally {
        transcribeButton.disabled = false;
    }
}

async function loadFirstAvailableTranscriber({ model, selectedDevice }) {
    const deviceCandidates = await resolveDeviceCandidates(selectedDevice);
    let lastError = null;

    for (const device of deviceCandidates) {
        try {
            setStatus(`Loading ${model} using ${device}...`);

            const transcriber = await loadTranscriber({
                model,
                device
            });

            return {
                transcriber,
                device
            };
        } catch (error) {
            lastError = error;
            transcriberCache.delete(createTranscriberCacheKey({
                model,
                device
            }));
            console.warn(`[TranscriptionSpike] Failed to load ${device} backend`, error);

            if (deviceCandidates.length > 1) {
                setStatus(`${device} failed; trying fallback backend...`);
            }
        }
    }

    throw lastError || new Error("No local transcription backend could be loaded.");
}

async function loadTranscriber({ model, device }) {
    const cacheKey = createTranscriberCacheKey({
        model,
        device
    });
    const cached = transcriberCache.get(cacheKey);
    if (cached) {
        return await cached;
    }

    const promise = pipeline(
        "automatic-speech-recognition",
        model,
        createPipelineOptions({
            device
        })
    );
    transcriberCache.set(cacheKey, promise);
    return await promise;
}

function createTranscriberCacheKey({ model, device }) {
    return `${model}::${device}`;
}

function createPipelineOptions({ device }) {
    const options = {
        progress_callback: reportModelLoadProgress
    };

    if (device === "webgpu") {
        options.device = "webgpu";
        options.dtype = "q4";
        return options;
    }

    // CPU / WASM path: prefer the safest model graph over the default
    // quantized graph that can fail with missing MatMulNBits scale tensors.
    options.dtype = "fp32";

    return options;
}

function reportModelLoadProgress(event) {
    const status = event?.status ? String(event.status) : "loading";
    const file = event?.file ? String(event.file) : "model files";
    const progress = Number(event?.progress);

    if (Number.isFinite(progress)) {
        setStatus(`Loading ${file}: ${Math.round(progress)}%`);
        return;
    }

    setStatus(`Loading ${file}: ${status}`);
}

async function resolveDeviceCandidates(selectedDevice) {
    if (selectedDevice === "webgpu") {
        return ["webgpu"];
    }

    if (selectedDevice === "wasm") {
        return ["wasm"];
    }

    if (await canRequestWebGpuAdapter()) {
        return ["webgpu", "wasm"];
    }

    return ["wasm"];
}

async function canRequestWebGpuAdapter() {
    if (!navigator.gpu || typeof navigator.gpu.requestAdapter !== "function") {
        return false;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        return Boolean(adapter);
    } catch (error) {
        console.warn("[TranscriptionSpike] WebGPU adapter probe failed", error);
        return false;
    }
}

function createTranscriptionOptions({ timestampMode }) {
    const options = {
        chunk_length_s: 30,
        stride_length_s: 5
    };

    if (timestampMode === "none") {
        return options;
    }

    if (timestampMode === "chunk") {
        options.return_timestamps = true;
        return options;
    }

    if (timestampMode === "word") {
        options.return_timestamps = "word";
        return options;
    }

    return options;
}
function renderResult({
    result,
    elapsedSeconds,
    model,
    device,
    timestampMode
}) {
    transcriptOutput.textContent = result?.text || "No transcript text returned.";
    renderChunks(result?.chunks || []);
    rawOutput.textContent = JSON.stringify({
        model,
        device,
        timestampMode,
        elapsedSeconds,
        result
    }, null, 2);
}

function renderChunks(chunks) {
    chunkTableBody.textContent = "";

    if (!Array.isArray(chunks) || chunks.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.textContent = "No chunks returned.";
        row.append(cell);
        chunkTableBody.append(row);
        return;
    }

    for (const chunk of chunks) {
        const row = document.createElement("tr");
        row.append(
            createCell(formatTimestamp(chunk?.timestamp?.[0])),
            createCell(formatTimestamp(chunk?.timestamp?.[1])),
            createCell(String(chunk?.text || ""))
        );
        chunkTableBody.append(row);
    }
}

function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
}

async function renderCapabilitySummary() {
    const webGpuApiStatus = navigator.gpu ? "API available" : "API not available";
    const webGpuAdapterStatus = await canRequestWebGpuAdapter() ? "adapter available" : "adapter not available";
    const memory = Number(navigator.deviceMemory);
    const memoryText = Number.isFinite(memory) ? `${memory} GB reported device memory` : "device memory not reported";

    capabilitySummary.textContent = `WebGPU: ${webGpuApiStatus}, ${webGpuAdapterStatus}; ${memoryText}. Auto tries WebGPU first only when an adapter is available, then falls back to CPU / WASM.`;
}

function clearOutputs() {
    transcriptOutput.textContent = "No transcript yet.";
    rawOutput.textContent = "No result yet.";
    renderChunks([]);
}

function setStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.style.color = isError ? "#b00020" : "";
}

function formatTimestamp(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) {
        return "";
    }

    return `${seconds.toFixed(2)}s`;
}

function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) {
        return "0 B";
    }

    const units = ["B", "KiB", "MiB", "GiB"];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function revokeSelectedAudioObjectUrl() {
    if (!selectedAudioObjectUrl) {
        return;
    }

    URL.revokeObjectURL(selectedAudioObjectUrl);
    selectedAudioObjectUrl = null;
}

window.addEventListener("pagehide", revokeSelectedAudioObjectUrl);
