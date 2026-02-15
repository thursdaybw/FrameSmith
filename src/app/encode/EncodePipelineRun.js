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
     * Stage: validate prerequisites.
     *
     * Checks that timeline + required browser capabilities are present.
     * Also clears previous encode diagnostics before new run starts.
     */
    runValidateStage() {
        this.state.currentPipelineStage = "validate";
        this.planning.validateEncodePrerequisites(this.timeline);
        this.reporting.clearEncodeDiagnosticsPanel();
    }

    /**
     * Stage: build plan context.
     *
     * Computes export range/fps and builds initial prerender plan.
     */
    runPlanStage() {
        this.tStart = this.runtime.now();
        this.state.currentPipelineStage = "plan";
        this.planContext = this.planning.buildEncodePlanContext(this.timeline);
    }

    /**
     * Stage: select tracks and normalize if needed.
     *
     * If source codec is unsupported, normalization swaps in a compatible working set.
     * Plan/timeline are updated to point at that normalized source.
     */
    async runTrackSelectStage() {
        this.state.currentPipelineStage = "track_select";
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
    }

    /**
     * Stage: configure audio decode setup.
     *
     * Creates per-run output buffers and prepares wrapped audio decoder path.
     */
    async runAudioDecoderConfigStage() {
        this.encodeOutputState = this.decoding.createEncodeOutputState();
        this.state.currentPipelineStage = "decoder_config_audio";
        this.audioDecoderSetup = await this.decoding.buildConfiguredAudioDecodeSetup(
            this.trackContext.audioTrackView
        );
        this.state.audioDecoder = this.audioDecoderSetup.audioDecoder;
    }

    /**
     * Stage: configure video decode setup.
     *
     * Builds decode port and fallback hook.
     * If runtime software fallback is triggered, we record that in run state.
     */
    async runVideoDecoderConfigStage() {
        this.state.currentPipelineStage = "decoder_config_video";
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
    }

    /**
     * Stage: configure output encoders.
     *
     * Sets target output dimensions/fps and stores encoder handles in run state.
     */
    async runEncoderConfigStage() {
        this.state.currentPipelineStage = "encoder_config_video";
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
    }

    /**
     * Stage: execute strategy.
     *
     * Runs decode -> compose -> encode across export range.
     * Result includes final MP4 bytes and diagnostics info.
     */
    async runExecuteStrategyStage() {
        this.state.currentPipelineStage = "execute_strategy";
        this.result = await this.encoding.executeStrategyAndMaybeLogDiagnostics({
            strategy: this.strategy,
            prerenderPlan: this.planContext.prerenderPlan,
            exportRange: this.planContext.exportRange,
            exportFps: this.planContext.exportFps,
            videoEncodedChunks: this.encodeOutputState.videoEncodedChunks,
            audioEncodedChunks: this.encodeOutputState.audioEncodedChunks
        });
    }

    /**
     * Stage: finalize output.
     *
     * Emits decode-path summary and stores final export artefacts for UI/export.
     */
    runFinalizeOutputStage() {
        this.state.currentPipelineStage = "finalize_output";
        this.encoding.finalizeEncodeOutput({
            result: this.result,
            tStart: this.tStart,
            videoEncodedChunks: this.encodeOutputState.videoEncodedChunks,
            audioEncodedChunks: this.encodeOutputState.audioEncodedChunks,
            didNormalizePredecode: this.state.didNormalizePredecode,
            didRuntimeSoftwareFallback: this.state.didRuntimeSoftwareFallback,
            encodeStartedAt: this.state.encodeStartedAt
        });
    }
}
