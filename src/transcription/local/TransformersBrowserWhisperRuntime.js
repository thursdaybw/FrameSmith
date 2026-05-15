import { BROWSER_WHISPER_DEVICE } from "./BrowserWhisperBackendProbe.js";

const DEFAULT_TRANSFORMERS_MODULE_URL = "../../../vendor/transformers/4.0.1/transformers.web.min.js";

/**
 * Runtime wrapper for Transformers.js browser ASR.
 *
 * This is infrastructure. It owns pipeline loading, backend-specific options,
 * and transcriber caching. It does not know about FrameSmith UI, timeline state,
 * recovery snapshots, or local/server fallback policy.
 */
export function createTransformersBrowserWhisperRuntime({
    importTransformers = (moduleUrl) => import(moduleUrl),
    transformersModuleUrl = DEFAULT_TRANSFORMERS_MODULE_URL,
    progressCallback = null,
    logger = console
} = {}) {
    const transcriberCache = new Map();

    return {
        async transcribe({
            sourceUrl,
            model,
            deviceCandidates,
            timestampMode = "word"
        }) {
            const { transcriber, device } = await loadFirstAvailableTranscriber({
                importTransformers,
                transformersModuleUrl,
                transcriberCache,
                model,
                deviceCandidates,
                progressCallback,
                logger
            });
            const result = await transcriber(sourceUrl, createTranscriptionOptions({ timestampMode }));

            return {
                result,
                device
            };
        }
    };
}

async function loadFirstAvailableTranscriber({
    importTransformers,
    transformersModuleUrl,
    transcriberCache,
    model,
    deviceCandidates,
    progressCallback,
    logger
}) {
    let lastError = null;

    for (const device of deviceCandidates) {
        try {
            const transcriber = await loadTranscriber({
                importTransformers,
                transformersModuleUrl,
                transcriberCache,
                model,
                device,
                progressCallback
            });
            return { transcriber, device };
        } catch (error) {
            lastError = error;
            transcriberCache.delete(createTranscriberCacheKey({ model, device }));
            logger?.warn?.(`[BrowserWhisper] Failed to load ${device} backend`, error);
        }
    }

    throw lastError || new Error("No local browser transcription backend could be loaded.");
}

async function loadTranscriber({
    importTransformers,
    transformersModuleUrl,
    transcriberCache,
    model,
    device,
    progressCallback
}) {
    const cacheKey = createTranscriberCacheKey({ model, device });
    const cached = transcriberCache.get(cacheKey);

    if (cached) {
        return await cached;
    }

    const promise = importTransformers(transformersModuleUrl).then(({ pipeline }) => {
        if (typeof pipeline !== "function") {
            throw new Error("Transformers.js module did not export pipeline.");
        }

        return pipeline(
            "automatic-speech-recognition",
            model,
            createPipelineOptions({
                device,
                progressCallback
            })
        );
    });

    transcriberCache.set(cacheKey, promise);
    return await promise;
}

function createTranscriberCacheKey({ model, device }) {
    return `${model}::${device}`;
}

export function createPipelineOptions({ device, progressCallback = null }) {
    const options = {};

    if (typeof progressCallback === "function") {
        options.progress_callback = progressCallback;
    }

    if (device === BROWSER_WHISPER_DEVICE.WEBGPU) {
        options.device = BROWSER_WHISPER_DEVICE.WEBGPU;
        options.dtype = "q4";
        return options;
    }

    // CPU/WASM path: prefer the safer graph over the default quantized graph,
    // which failed in the spike with missing MatMulNBits scale tensors.
    options.dtype = "fp32";
    return options;
}

export function createTranscriptionOptions({ timestampMode = "word" } = {}) {
    const options = {
        chunk_length_s: 30,
        stride_length_s: 5
    };

    if (timestampMode === "chunk") {
        options.return_timestamps = true;
        return options;
    }

    if (timestampMode === "word") {
        options.return_timestamps = "word";
    }

    return options;
}
