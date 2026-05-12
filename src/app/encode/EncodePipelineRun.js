/**
 * EncodePipelineRun
 *
 * This class runs one full export pipeline from start to finish.
 *
 * Plain English:
 * - It does not do low-level codec math itself.
 * - It calls the right ports in the right order.
 * - It tracks stage and resources so failures can be reported and cleaned up.
 *
 * Why this exists:
 * - Keep `script.js` small and readable.
 * - Keep pipeline order in one place.
 * - Make stage boundaries explicit for testing and refactoring.
 */

/**
 * Build per-run state used for error reporting and cleanup.
 *
 * `now` is injected so callers can control time in tests.
 */
export function createEncodeRunState({ now }) {
    return {
        currentPipelineStage: "init",
        encodeStartedAt: now(),
        stageTimingMs: {},
        stageOrder: [],
        executeBreakdownMs: {
            decodeRange: 0,
            decodeCalls: 0,
            executeStrategy: 0,
            nonDecodeExecute: 0,
            composeAtTime: 0,
            encodeAtTime: 0,
            composeVideoArtifact: 0,
            composeVideoSelectSource: 0,
            composeVideoDrawBaseFrame: 0,
            composeVideoDrawRenderIntents: 0,
            composeVideoAllocateFrame: 0,
            composeAudioArtifact: 0,
            composeAudioAllocateData: 0,
            encodeVideoHook: 0,
            encodeAudioHook: 0,
            flushEncoders: 0,
            adaptOutputs: 0,
            compileMp4: 0,
            nonDecodeUnattributed: 0
        },
        normalizationSourceUrlToRevoke: { value: null },
        didNormalizePredecode: false,
        didRuntimeSoftwareFallback: false,
        audioDecoder: null,
        videoEncoder: null,
        audioEncoder: null,
        releaseDecodeResources: () => {}
    };
}

export class EncodePipelineRun {
    /**
     * Create one pipeline run object.
     *
     * Inputs are grouped by concern:
     * - `planning`: build plan and select tracks
     * - `normalization`: fix unsupported source codecs
     * - `decoding`: create decoders/decode ports
     * - `encoding`: create encoders and run export strategy
     * - `reporting`: UI/debug signals
     * - `runtime`: time and output config
     */
    constructor({
        timeline,
        runtime,
        reporting,
        planning,
        normalization,
        decoding,
        encoding
    }) {
        this.timeline = timeline;
        this.runtime = runtime;
        this.reporting = reporting;
        this.planning = planning;
        this.normalization = normalization;
        this.decoding = decoding;
        this.encoding = encoding;
        this.state = createEncodeRunState({
            now: this.runtime.now
        });
        this.tStart = 0;
        this.planContext = null;
        this.trackContext = null;
        this.encodeOutputState = null;
        this.audioDecoderSetup = null;
        this.decodeSetup = null;
        this.encoderSetup = null;
        this.strategy = null;
        this.result = null;
    }

    /**
     * Expose run state so outer app code can emit failure summary and cleanup.
     */
    get runState() {
        return this.state;
    }

    /**
     * Run the full pipeline in strict order.
     *
     * Each stage has one job.
     * If any stage throws, caller handles summary + cleanup.
     */
    async run() {
        this.runValidateStage();
        this.runPlanStage();
        await this.runTrackSelectStage();
        await this.runAudioDecoderConfigStage();
        await this.runVideoDecoderConfigStage();
        await this.runEncoderConfigStage();
        this.buildStrategy();
        await this.runExecuteStrategyStage();
        this.runFinalizeOutputStage();
    }

    /**
     * Mark a stage as started and set it as current failure context.
     */
    beginStage(stageName) {
        this.state.currentPipelineStage = stageName;
        if (typeof this.reporting?.onEncodeStageChange === "function") {
            this.reporting.onEncodeStageChange({ stageName });
        }
        this.state.stageOrder.push(stageName);
        this.state.stageTimingMs[stageName] = {
            startedAtMs: this.runtime.now(),
            elapsedMs: null
        };
    }

    /**
     * Mark a stage as finished, even if it failed.
     */
    endStage(stageName) {
        const stage = this.state.stageTimingMs[stageName];
        if (!stage) {
            return;
        }
        if (typeof stage.elapsedMs === "number") {
            return;
        }
        stage.elapsedMs = Math.max(0, Math.round(this.runtime.now() - stage.startedAtMs));
    }

    /**
     * Stage: validate prerequisites.
     *
     * Checks that timeline + required browser capabilities are present.
     * Also clears previous encode diagnostics before new run starts.
     */
    runValidateStage() {
        const stageName = "validate";
        this.beginStage(stageName);
        try {
            this.planning.validateEncodePrerequisites(this.timeline);
            this.reporting.clearEncodeDiagnosticsPanel();
        } finally {
            this.endStage(stageName);
        }
    }

    /**
     * Stage: build plan context.
     *
     * Computes export range/fps and builds initial prerender plan.
     */
    runPlanStage() {
        const stageName = "plan";
        this.beginStage(stageName);
        try {
            this.tStart = this.runtime.now();
            this.planContext = this.planning.buildEncodePlanContext(this.timeline);
        } finally {
            this.endStage(stageName);
        }
    }

    /**
     * Stage: select tracks and normalize if needed.
     *
     * If source codec is unsupported, normalization swaps in a compatible working set.
     * Plan/timeline are updated to point at that normalized source.
     */
    async runTrackSelectStage() {
        const stageName = "track_select";
        this.beginStage(stageName);
        try {
            const selectedTracks = this.planning.selectExecutionTrackViewsWithRotation(
                this.planContext.executionTimeline
            );
            this.trackContext = await this.normalization.maybeNormalizeExecutionTimelineForUnsupportedDecoder({
                executionTimeline: this.planContext.executionTimeline,
                prerenderPlan: this.planContext.prerenderPlan,
                exportRange: this.planContext.exportRange,
                videoTrackView: selectedTracks.videoTrackView,
                audioTrackView: selectedTracks.audioTrackView,
                sourceRotationDegrees: selectedTracks.sourceRotationDegrees
            });
            this.state.didNormalizePredecode = this.trackContext.didNormalizePredecode;
            this.state.normalizationSourceUrlToRevoke.value = this.trackContext.normalizationSourceUrlToRevoke;
            this.planContext.executionTimeline = this.trackContext.executionTimeline;
            this.planContext.prerenderPlan = this.trackContext.prerenderPlan;
            if (Number.isFinite(this.trackContext.recommendedExportFps)) {
                this.planContext.exportFps = this.resolveRecommendedExportFpsForCapacityProfile(
                    this.trackContext.recommendedExportFps
                );
            }
        } finally {
            this.endStage(stageName);
        }
    }

    /**
     * Normalization may reveal the source cadence after the profile has already capped
     * the export. On constrained devices the cap wins because a higher recovered FPS
     * can put the browser back into the memory pressure path the profile is avoiding.
     */
    resolveRecommendedExportFpsForCapacityProfile(recommendedExportFps) {
        const profileFps = this.planContext?.encodeCapacityProfile?.fps;
        if (
            this.planContext?.encodeCapacityProfile?.name === "mobile-safe" &&
            Number.isFinite(profileFps) &&
            profileFps > 0
        ) {
            return Math.min(recommendedExportFps, profileFps);
        }
        return recommendedExportFps;
    }

    /**
     * Stage: configure audio decode setup.
     *
     * Creates per-run output buffers and prepares wrapped audio decoder path.
     */
    async runAudioDecoderConfigStage() {
        this.encodeOutputState = this.decoding.createEncodeOutputState();
        const stageName = "decoder_config_audio";
        this.beginStage(stageName);
        try {
            this.audioDecoderSetup = await this.decoding.buildConfiguredAudioDecodeSetup(
                this.trackContext.audioTrackView
            );
            this.state.audioDecoder = this.audioDecoderSetup.audioDecoder;
        } finally {
            this.endStage(stageName);
        }
    }

    /**
     * Stage: configure video decode setup.
     *
     * Builds decode port and fallback hook.
     * If runtime software fallback is triggered, we record that in run state.
     */
    async runVideoDecoderConfigStage() {
        const stageName = "decoder_config_video";
        this.beginStage(stageName);
        try {
            this.decodeSetup = await this.decoding.createDecodePortForTrack({
                videoTrackView: this.trackContext.videoTrackView,
                wrappedAudioDecoder: this.audioDecoderSetup.wrappedAudioDecoder,
                didNormalizePredecode: this.state.didNormalizePredecode,
                onSoftwareFallback: ({ error, range }) => {
                    this.state.didRuntimeSoftwareFallback = true;
                    this.reporting.emitDecodeFallbackSignal({ error, range });
                }
            });
            this.state.releaseDecodeResources = this.decodeSetup.releaseDecoders;
            const sourceDecodePort = this.decodeSetup.decodePort;
            this.decodeSetup.decodePort = {
                ...sourceDecodePort,
                decodeRange: async (args) => {
                    const startedAtMs = this.runtime.now();
                    try {
                        return await sourceDecodePort.decodeRange(args);
                    } finally {
                        const elapsedMs = Math.max(0, Math.round(this.runtime.now() - startedAtMs));
                        this.state.executeBreakdownMs.decodeRange += elapsedMs;
                        this.state.executeBreakdownMs.decodeCalls += 1;
                    }
                }
            };
        } finally {
            this.endStage(stageName);
        }
    }

    /**
     * Stage: configure output encoders.
     *
     * Sets target output dimensions/fps and stores encoder handles in run state.
     */
    async runEncoderConfigStage() {
        const stageName = "encoder_config_video";
        this.beginStage(stageName);
        try {
            this.encoderSetup = await this.encoding.createConfiguredEncoders({
                exportFps: this.planContext.exportFps,
                outputWidth: this.runtime.outputConfig.width,
                outputHeight: this.runtime.outputConfig.height,
                videoEncodedChunks: this.encodeOutputState.videoEncodedChunks,
                audioEncodedChunks: this.encodeOutputState.audioEncodedChunks,
                setVideoDecoderConfig: (decoderConfig) => {
                    if (!this.encodeOutputState.videoDecoderConfig) {
                        this.encodeOutputState.videoDecoderConfig = decoderConfig;
                    }
                },
                setAudioDecoderConfig: (decoderConfig) => {
                    if (!this.encodeOutputState.audioDecoderConfig) {
                        this.encodeOutputState.audioDecoderConfig = decoderConfig;
                    }
                }
            });
            this.state.videoEncoder = this.encoderSetup.videoEncoder;
            this.state.audioEncoder = this.encoderSetup.audioEncoder;
            this.state.currentPipelineStage = "encoder_config_audio";
        } finally {
            this.endStage(stageName);
        }
    }

    /**
     * Stage: build export strategy.
     *
     * Wires decode port + timeline + encoders into one strategy object.
     */
    buildStrategy() {
        this.strategy = this.encoding.createExportStrategy({
            decodePort: this.decodeSetup.decodePort,
            executionTimeline: this.planContext.executionTimeline,
            exportRange: this.planContext.exportRange,
            exportFps: this.planContext.exportFps,
            configuredVideoEncoderConfig: this.encoderSetup.configuredVideoEncoderConfig,
            videoTrackView: this.trackContext.videoTrackView,
            videoEncoder: this.state.videoEncoder,
            audioEncoder: this.state.audioEncoder,
            videoEncodedChunks: this.encodeOutputState.videoEncodedChunks,
            audioEncodedChunks: this.encodeOutputState.audioEncodedChunks,
            getVideoDecoderConfig: () => this.encodeOutputState.videoDecoderConfig,
            getAudioDecoderConfig: () => this.encodeOutputState.audioDecoderConfig
        });
        this.instrumentStrategyBreakdownHooks();
    }

    /**
     * Wrap strategy callbacks to measure major execute-strategy sub-buckets.
     */
    instrumentStrategyBreakdownHooks() {
        if (!this.strategy || typeof this.strategy !== "object") {
            return;
        }
        const wrapTimedMethod = (methodName, bucketName) => {
            const original = this.strategy[methodName];
            if (typeof original !== "function") {
                return;
            }
            this.strategy[methodName] = async (...args) => {
                const startedAtMs = this.runtime.now();
                try {
                    return await original.apply(this.strategy, args);
                } finally {
                    this.state.executeBreakdownMs[bucketName] += Math.max(
                        0,
                        Math.round(this.runtime.now() - startedAtMs)
                    );
                }
            };
        };
        const wrapTimedSyncMethod = (methodName, bucketName) => {
            const original = this.strategy[methodName];
            if (typeof original !== "function") {
                return;
            }
            this.strategy[methodName] = (...args) => {
                const startedAtMs = this.runtime.now();
                try {
                    return original.apply(this.strategy, args);
                } finally {
                    this.state.executeBreakdownMs[bucketName] += Math.max(
                        0,
                        Math.round(this.runtime.now() - startedAtMs)
                    );
                }
            };
        };
        wrapTimedSyncMethod("encodeVideoFrame", "encodeVideoHook");
        wrapTimedSyncMethod("encodeAudioData", "encodeAudioHook");
        wrapTimedMethod("flushVideoEncoder", "flushEncoders");
        wrapTimedMethod("flushAudioEncoder", "flushEncoders");
        wrapTimedSyncMethod("adaptEncodedOutputsToMp4BuildInputFn", "adaptOutputs");
        wrapTimedSyncMethod("createMp4FromInputsFn", "compileMp4");
    }

    /**
     * Stage: execute strategy.
     *
     * Runs decode -> compose -> encode across export range.
     * Result includes final MP4 bytes and diagnostics info.
     */
    async runExecuteStrategyStage() {
        const stageName = "execute_strategy";
        this.beginStage(stageName);
        const executeStartedAtMs = this.runtime.now();
        try {
            this.result = await this.encoding.executeStrategyAndMaybeLogDiagnostics({
                strategy: this.strategy,
                prerenderPlan: this.planContext.prerenderPlan,
                exportRange: this.planContext.exportRange,
                exportFps: this.planContext.exportFps,
                videoEncodedChunks: this.encodeOutputState.videoEncodedChunks,
                audioEncodedChunks: this.encodeOutputState.audioEncodedChunks
            });
            const executeTimingMs = this.result?.executeTimingMs;
            if (executeTimingMs && typeof executeTimingMs === "object") {
                if (Number.isFinite(executeTimingMs.composeAtTime)) {
                    this.state.executeBreakdownMs.composeAtTime = executeTimingMs.composeAtTime;
                }
                if (Number.isFinite(executeTimingMs.encodeAtTime)) {
                    this.state.executeBreakdownMs.encodeAtTime = executeTimingMs.encodeAtTime;
                }
                if (Number.isFinite(executeTimingMs.composeVideoArtifact)) {
                    this.state.executeBreakdownMs.composeVideoArtifact = executeTimingMs.composeVideoArtifact;
                }
                if (Number.isFinite(executeTimingMs.composeVideoSelectSource)) {
                    this.state.executeBreakdownMs.composeVideoSelectSource = executeTimingMs.composeVideoSelectSource;
                }
                if (Number.isFinite(executeTimingMs.composeVideoDrawBaseFrame)) {
                    this.state.executeBreakdownMs.composeVideoDrawBaseFrame = executeTimingMs.composeVideoDrawBaseFrame;
                }
                if (Number.isFinite(executeTimingMs.composeVideoDrawRenderIntents)) {
                    this.state.executeBreakdownMs.composeVideoDrawRenderIntents = executeTimingMs.composeVideoDrawRenderIntents;
                }
                if (Number.isFinite(executeTimingMs.composeVideoAllocateFrame)) {
                    this.state.executeBreakdownMs.composeVideoAllocateFrame = executeTimingMs.composeVideoAllocateFrame;
                }
                if (Number.isFinite(executeTimingMs.composeAudioArtifact)) {
                    this.state.executeBreakdownMs.composeAudioArtifact = executeTimingMs.composeAudioArtifact;
                }
                if (Number.isFinite(executeTimingMs.composeAudioAllocateData)) {
                    this.state.executeBreakdownMs.composeAudioAllocateData = executeTimingMs.composeAudioAllocateData;
                }
            }
        } finally {
            this.state.executeBreakdownMs.executeStrategy = Math.max(
                0,
                Math.round(this.runtime.now() - executeStartedAtMs)
            );
            this.state.executeBreakdownMs.nonDecodeExecute = Math.max(
                0,
                this.state.executeBreakdownMs.executeStrategy - this.state.executeBreakdownMs.decodeRange
            );
            const knownNonDecodeBuckets =
                this.state.executeBreakdownMs.encodeAtTime +
                this.state.executeBreakdownMs.composeVideoArtifact +
                this.state.executeBreakdownMs.composeVideoSelectSource +
                this.state.executeBreakdownMs.composeVideoDrawBaseFrame +
                this.state.executeBreakdownMs.composeVideoDrawRenderIntents +
                this.state.executeBreakdownMs.composeVideoAllocateFrame +
                this.state.executeBreakdownMs.composeAudioArtifact +
                this.state.executeBreakdownMs.composeAudioAllocateData +
                this.state.executeBreakdownMs.encodeVideoHook +
                this.state.executeBreakdownMs.encodeAudioHook +
                this.state.executeBreakdownMs.flushEncoders +
                this.state.executeBreakdownMs.adaptOutputs +
                this.state.executeBreakdownMs.compileMp4;
            this.state.executeBreakdownMs.nonDecodeUnattributed = Math.max(
                0,
                this.state.executeBreakdownMs.nonDecodeExecute - knownNonDecodeBuckets
            );
            this.endStage(stageName);
        }
    }

    /**
     * Stage: finalize output.
     *
     * Emits decode-path summary and stores final export artefacts for UI/export.
     */
    runFinalizeOutputStage() {
        const stageName = "finalize_output";
        this.beginStage(stageName);
        try {
            this.encoding.finalizeEncodeOutput({
                result: this.result,
                tStart: this.tStart,
                videoEncodedChunks: this.encodeOutputState.videoEncodedChunks,
                audioEncodedChunks: this.encodeOutputState.audioEncodedChunks,
                didNormalizePredecode: this.state.didNormalizePredecode,
                didRuntimeSoftwareFallback: this.state.didRuntimeSoftwareFallback,
                encodeStartedAt: this.state.encodeStartedAt,
                stageTimingMs: this.state.stageTimingMs,
                stageOrder: this.state.stageOrder,
                executeBreakdownMs: this.state.executeBreakdownMs
            });
        } finally {
            this.endStage(stageName);
        }
    }
}
