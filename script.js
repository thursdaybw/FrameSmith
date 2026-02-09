/**
 * FrameSmith — Application Driver (Pre-Alpha)
 *
 * This file is a temporary orchestration layer used during early development.
 * It wires together preview rendering, offline pre-rendering, and future
 * encode/export stages.
 *
 * IMPORTANT:
 * This file is NOT the domain model.
 * This file is NOT the timeline compiler.
 * This file is glue code while the architecture is being discovered.
 *
 * -------------------------------------------------
 * Core Architectural Truth
 * -------------------------------------------------
 *
 * FrameSmith is not a video player.
 * FrameSmith is a timeline compiler.
 *
 * Preview exists only to visualise timeline evaluation.
 * Pre-render exists to deterministically evaluate the timeline.
 * Encoding and export consume the results of pre-render.
 *
 * Preview, pre-render, encode, and export are separate concerns.
 *
 * -------------------------------------------------
 * Current Phases (As Implemented Today)
 * -------------------------------------------------
 *
 * 1. Preview Phase (Real-Time, Non-Deterministic)
 *
 *    - Uses browser playback and rendering APIs.
 *    - Renders video frames to a canvas for visual inspection.
 *    - Plays audio via the browser audio output.
 *    - No data produced here is used for encoding or export.
 *
 *    Preview is disposable.
 *
 * 2. Timeline → Pre-Render Planning Phase (Offline, Deterministic)
 *
 *    - Evaluates the timeline without relying on playback.
 *    - Produces a Pre-Render Plan.
 *    - Describes what will be pre-rendered.
 *
 *    Does NOT:
 *    - decode media
 *    - generate VideoFrame
 *    - generate AudioData
 *    - sample wall-clock time
 *
 * 3. Offline Rendering (Pre-Render) — NOT YET IMPLEMENTED
 *
 *    - Consumes the Pre-Render Plan.
 *    - Decodes media into:
 *        - VideoFrame objects
 *        - AudioData objects
 *    - Produces deterministic, timestamped frame buffers.
 *
 *    No preview, no playback, no encoding.
 *
 * 4. Encode Phase (Planned, Not Yet Implemented)
 *
 *    - Consumes pre-rendered VideoFrame and AudioData objects.
 *    - Uses WebCodecs to produce compressed access units.
 *
 * 5. Export Phase (Planned)
 *
 *    - Packages encoded access units into an MP4 container.
 *
 * A fragment is not an access unit
 * A fragment describes access-unit work
 * A timeline never owns a plan*
 *
 *
 * Architectural Note: Tracks vs Output Domains
 *
 * FrameSmith does NOT use "track types" (e.g. video, audio, subtitle) as a core
 * engine concept. Tracks exist only as structural groupings that define ordering,
 * overlap, and layering of clips within the timeline. Rendering semantics are
 * derived from the *contribution domain* of each clip or asset (e.g. video, audio),
 * not from the track it resides on. This avoids coupling editor UI conventions
 * (such as NLE track types) to the timeline compiler and allows procedural and
 * container-backed contributors to participate uniformly in pre-render execution.
 *
 * -------------------------------------------------
 * IMPORTANT: Demo Constraints (Non-Architectural)
 * -------------------------------------------------
 *
 * This file represents ONE temporary application entry point:
 * a container-backed, HTMLVideoElement-driven demo workflow.
 *
 * Assumptions made here are NOT FrameSmith domain rules.
 *
 * In particular:
 * - This demo assumes a container-backed video source exists.
 * - This demo treats video as the render-driving track.
 * - Audio is optional in this path.
 *
 * These constraints exist ONLY to support:
 * - HTMLVideoElement preview
 * - Early timeline compilation experiments
 *
 * FrameSmith as a system DOES NOT require:
 * - container-backed media
 * - video tracks
 * - HTML elements
 *
 * Other valid timelines include:
 * - procedural video (generated frames)
 * - audio-only timelines
 * - text-only or image-only timelines
 *
 * Any future architecture MUST NOT infer mandatory video
 * or container-backed media from this file.
 *
 * -------------------------------------------------
 * Scope Warning
 * -------------------------------------------------
 *
 * This file currently uses HTMLVideoElement and browser APIs
 * as a TEMPORARY stand-in for future asset and timeline systems.
 *
 * These APIs MUST NOT leak into:
 *   - the timeline model
 *   - the pre-render contract
 *   - the encoder inputs
 *
 * Any such usage is provisional and expected to be removed.
 *
 * ### Glossary
 * * **Real-Time Rendering (Preview)**: Frames composited live to the canvas for previewing effects and timeline edits. These frames are not encoded or stored persistently.
 * * **Timeline → Pre-Render Planning**: Deterministic evaluation of the editing timeline to produce a **Pre-Render Plan** describing what must be pre-rendered (access units and procedural intent), without decoding, rendering, or generating `VideoFrame` or `AudioData`.
 * * **Offline Rendering (Pre-Render)**: Deterministically evaluate the timeline into timestamped media buffers (VideoFrame, AudioData) by executing all active contributors (container-backed and procedural) without playback, preview, or encoding.
 * * **Encoding (WebCodecs)**: The process of taking `VideoFrame` and `AudioData` objects and producing compressed video and audio samples suitable for packaging into a container (MP4). Encoding does **not** include preview rendering.
 * * **Access Units / Samples**: The output of the WebCodecs encoder. Video samples (H.264 NAL units) and audio samples (Opus frames) that are later written into an MP4 container.
 * **Timeline**: The Timeline is the central piece that represents the entire sequence of events to be rendered or played back. It contains an ordered collection of Tracks (for audio, video, and other assets). It organizes how clips are sequenced and overlaid in time.
 * **Track**: A Track is an organizational layer in the timeline that contains clips. Tracks can be video, audio, or other asset types. Tracks organize media clips in sequence and help manage their relationships (e.g., audio and video can exist on separate tracks).
 * **Clip**: A Clip is a time-bound section of a media asset (video, audio, etc.). It has a start time, an end time, and can contain transformations or effects like scaling, rotation, opacity, etc. Clips are the smallest editable unit in the timeline. They may be layered, resized, and positioned in time.
 * **Asset**: An Asset is a media resource (like a video file, an audio file, an image, etc.) referenced by the timeline. Assets are the actual media that clips point to.
 * **Track vs Clip: Relationship**: A Track contains multiple Clips. Clips exist in time on the Track. For video, a clip would reference a segment of a video file with a start and end time. For audio, a clip would reference a segment of an audio file with a start and end time.
 *
 *  ## The real domain of this application: 
 * 
 *  * FrameSmith is not a video player.
 *  * FrameSmith is a timeline compiler.
 *
 * That means the true domain objects are:
 *  * assets
 *  * clips
 *  * tracks
 *  * time ranges
 *  * transforms
 *  * render plans
 *  * Not elements.
 *  * Not players.
 *  * Not HTML.
 *
 * Pre-render does not read from the preview.
 * Pre-rKey rule (this prevents access-unit-centrism)
 * 
 * The prerender plan does not describe tracks.
 * It describes contributors.
 * 
 * Contributors can be:
 * - container-backed (video/audio access units)
 * - procedural (image overlays, text overlays)
 * - future things (effects, generators)
 * 
 * This means:
 * - buildAccessUnitPlanFragmentFromTrack is fine but it must be seen as one contributor type “the plan”
 * 
 * Before execution:
 * 
 * The plan must clearly say what kind of work each fragment represents
 * and what it will emit when executed
 * 
 * ## Prerender executor
 *
 * For each plan fragment:
 * - dispatch by fragment kind
 * - execute deterministically
 * - emit timestamped buffers
 * - do no preview, playback, or encoding
 *
 * TODO:
 * Remove track types / roles from the demo completely - Done
 * Make the prerender plan describe contributors, not “tracks” - Done?!
 * Add prerender execution that consumes a PreRenderPlan
 * Add decode stage that consumes this plan
 * Add encode stage.
 */

import { drawTextOverlayForTime } from "./textOverlayRenderer.js";
import { createRenderPlan, createImageNode } from "./renderPlan/RenderPlan.js";
import { renderFrame } from "./renderPlan/RenderPlanRenderer.js";


import { listTracksFromMp4 } from "./src/mux/native/demux/container/listTracksFromMp4.js";
import { createContainerTrackViewFromMp4 } from "./src/mux/native/demux/trackview/createContainerTrackViewFromMp4.js";

import { buildAccessUnitPlanFragmentFromTrack, buildPrerenderPlanFromTimeline } from "./src/timeline/compileTimeline.js";

import { createId } from "./src/core/identity/createId.js";

document.addEventListener("DOMContentLoaded", () => {

    // Initialize the timeline, tracks, and clips
    const timeline = createTimeline();

    // Now you can interact with the timeline, tracks, and clips here
    //console.log(timeline);  // Debug log to ensure timeline is set up correctly

    const renderPlan = createRenderPlan();

    const logoImg = new Image();
    logoImg.src = "./logo.png";

    /* ADD THIS BLOCK HERE — ONCE */
    const LOGO_X = 0.03;   // 3% from left
    const LOGO_Y = 0.03;   // 3% from top
    const LOGO_W = 0.30;   // 30% of frame width
    const LOGO_H = null;   // TEMP — square logo

    renderPlan.elements.push(
        createImageNode(logoImg, LOGO_X, LOGO_Y, LOGO_W, LOGO_H)
    );

    // -------------------------------------------------
    // Pre-render timing configuration
    // -------------------------------------------------
    const PRE_RENDER_FPS = 30;
    const PRE_RENDER_FRAME_DURATION_US = Math.floor(1_000_000 / PRE_RENDER_FPS);

    const prerenderBtn = document.getElementById("prerenderBtn");
    const previewBtn = document.getElementById("previewBtn");
    const encodeBtn = document.getElementById("encodeBtn");

    // DEMO ONLY:
    // This HTMLVideoElement exists solely to support preview playback.
    // It must not be considered a required dependency of FrameSmith.
    // Future entry points may have no DOM, no video element, and no container.
    const video = document.getElementById("v");
    const canvas = document.getElementById("c");
    const context = canvas.getContext("2d");

    let audioDataFrames = [];


    const textOverlays = [
        {
            start: 0,
            end: 30,
            override: [],
            animate: [],
            words: [
                {
                    start: 0,
                    end: 30,
                    text: "Hello",
                    override: ["muted"],
                    animate: []
                },
                {
                    start: 0,
                    end: 30,
                    text: "World",
                    override: [],
                    animate: ["pulse"]
                }
            ]
        }
    ];

    /**
     * Pre-Render Button Handler (Offline Timeline Evaluation)
     *
     * Purpose:
     * - Deterministically evaluate the timeline structure.
     * - Produce a *render plan* describing what media access units
     *   must be processed, in what order.
     *
     * What pre-render produces (CURRENT STAGE):
     * - Video access-unit plan (container-timed, ordered)
     * - Audio access-unit plan (container-timed, ordered)
     *
     * What pre-render explicitly does NOT do:
     * - It does NOT decode media
     * - It does NOT produce VideoFrame or AudioData objects
     * - It does NOT sample by wall-clock time
     * - It does NOT rely on preview or playback APIs
     * - It does NOT encode
     *
     * Architectural Rule:
     * - Pre-render PUSHES access units forward.
     * - Later stages DECIDE how to decode, render, or encode them.
     *
     * This handler marks the boundary between:
     * - Timeline compilation (this stage)
     * - Media execution (future stages)
     */
    prerenderBtn.onclick = () => {

        console.log("Prerender button clicked");

        try {
            const prerenderPlan = buildPrerenderPlanFromTimeline({ timeline });

            console.log("Pre-render plan complete", {
                videoAccessUnits: prerenderPlan.videoAccessUnits.length,
                audioAccessUnits: prerenderPlan.audioAccessUnits.length
            });

            // Temporary: expose for inspection
            window.__prerenderPlan = prerenderPlan;

        } catch (error) {
            console.error("Error during pre-render planning:", error);
        }
    };

    /**
     * Encode Button Handler
     *
     * Purpose:
     * - Takes the pre-rendered VideoFrame and AudioData buffers and encodes them into compressed samples.
     *
     * What it does:
     * - Uses **WebCodecs** to encode video frames into the configured codec (e.g., H.264) and audio samples (e.g., Opus).
     * - Generates encoded video and audio samples ready to be packaged into an MP4 container.
     * - This is a non-real-time process; all frames are processed sequentially from the pre-rendered buffers.
     *
     * Time Considerations:
     * - Encoding is computationally expensive and can take time proportional to video length and resolution.
     * - Any effects already applied during pre-render are preserved and encoded in the output samples.
     *
     * Notes:
     * - Does not create the MP4 container itself. Encoded samples are stored in memory for the final export step.
     * - Works only after preRenderBtn has been executed successfully.
     * - The Export button remains disabled until a separate container packaging step is implemented.
     */
    encodeBtn.onclick = async () => {
        // Implementation: feed pre-rendered VideoFrame and AudioData buffers into WebCodecs for encoding
    };


});

function downloadBlob(blob, filename) {
    console.log("STEP0: downloadBlob CALLED, blob.size =", blob.size);

    // NEW: dump the blob to the window for manual inspection
    window.__lastBlob = blob;
    console.log("STEP0b: saved blob to window.__lastBlob");

    const url = URL.createObjectURL(blob);
    console.log("STEP1: object URL =", url);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    console.log("STEP2: anchor appended to DOM:", a);

    a.addEventListener("click", () => {
        console.log("STEP3: anchor CLICK event fired");
    });

    console.log("STEP4: calling a.click()");
    a.click();

    console.log("STEP5: after a.click() (if this prints, JS did not crash)");

    // clean up later
    setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log("STEP6: object URL revoked and anchor removed");
    }, 5000);
}
window.downloadBlob = downloadBlob;

window.testDownload = () => {
    const blob = new Blob(["hello"], { type: "text/plain" });
    downloadBlob(blob, "test.txt");
};

function findClosestAudioFrame(audioFrames, timestampUs) {
    let closest = audioFrames[0];
    let minDelta = Math.abs(audioFrames[0].timestamp - timestampUs);

    for (const frame of audioFrames) {
        const delta = Math.abs(frame.timestamp - timestampUs);
        if (delta < minDelta) {
            minDelta = delta;
            closest = frame;
        }
    }

    return { closest, deltaUs: minDelta };
}

/**
 * Timeline
 *
 * The top-level structural container for compilation.
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Own tracks
 * - Define overall duration
 *
 * INTENTIONALLY OUT OF SCOPE *FOR THIS STAGE*:
 * - Media decoding
 * - Rendering
 * - Playback or preview concerns
 *
 * NOTES:
 * - Timeline evaluation is performed by walking clips and access units.
 * - Time-based querying will reappear in later, higher-level stages.
 */
class Timeline {

    constructor(duration) {
        this.id = createId(); // Engine identity (opaque, stable)
        this.tracks = [];
        this.duration = duration;
    }

    addTrack(track) {
        this.tracks.push(track);
    }

}

let textOverlays = [];  // Declare textOverlays in the global scope

/**
 * createTimeline
 * =====================================================
 *
 * APPLICATION SERVICE — TEMPORARY ORCHESTRATION
 *
 * Purpose:
 * --------
 * Assemble a Timeline from editor intent and external assets.
 *
 * This function is an application-level use case.
 * It coordinates infrastructure adapters and domain objects,
 * but contains NO domain rules of its own.
 *
 * Responsibilities (ALLOWED):
 * ---------------------------
 * - Fetch container bytes for referenced media assets
 * - Invoke demux boundary adapters
 * - Construct ContainerTrackView instances
 * - Assemble an Mp4Asset from pre-built TrackViews
 * - Select which tracks participate in the Timeline
 * - Instantiate Timeline, Track, and Clip objects
 *
 * Responsibilities (EXPLICITLY FORBIDDEN):
 * ---------------------------------------
 * - Parsing MP4 boxes
 * - Interpreting container structure
 * - Inferring codec behavior
 * - Decoding media
 * - Sampling by time
 * - Rendering frames or audio
 * - Applying timeline policy (trimming logic lives in Clip)
 *
 * Architectural Notes:
 * --------------------
 * - Demux EXECUTION lives in the demuxer.
 * - Demux INVOCATION lives here.
 * - Mp4Asset is constructed AFTER demux and must not
 *   acquire container knowledge.
 *
 * - Track selection performed here is APPLICATION POLICY,
 *   not a container rule and not a domain invariant.
 *
 * Lifecycle:
 * ----------
 * - This function is expected to shrink, move, or disappear
 *   as editor intent becomes explicit and persistent.
 * - Its verbosity is intentional to keep boundaries visible.
 *
 * Invariants:
 * -----------
 * - Domain objects (Timeline, Track, Clip) remain container-agnostic.
 * - No HTML, playback, or browser APIs may leak past this boundary.
 */
async function createTimeline() {
    const videoElement = document.getElementById("v");

    // -------------------------------------------------
    // Fetch MP4 bytes (application responsibility)
    // -------------------------------------------------
    const resp = await fetch(videoElement.src);
    if (!resp.ok) {
        throw new Error("Failed to fetch MP4: " + videoElement.src);
    }
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------
    // Demux container tracks (boundary invocation)
    // -------------------------------------------------
    const containerTracks = listTracksFromMp4({ mp4Bytes });

    // -------------------------------------------------
    // Build ContainerTrackViews (lazy, semantic)
    // -------------------------------------------------
    const trackViews = containerTracks.map(trackInfo =>
        createContainerTrackViewFromMp4({
            mp4Bytes,
            trackIndex: trackInfo.zeroBasedTrackIndex
        })
    );

    // -------------------------------------------------
    // Assemble Mp4Asset (post-demux, no container knowledge)
    // -------------------------------------------------
    const mp4Asset = new Mp4Asset({ trackViews });

    /**
     * Track selection policy
     *
     * IMPORTANT:
     * - Mp4Asset exposes ALL tracks present in the container.
     * - Selection of which tracks to use is EDITOR INTENT.
     * - This policy is temporary and intentionally explicit.
     *
     * Future versions may:
     * - Allow user selection
     * - Support multiple video/audio tracks
     * - Attach tracks dynamically
     */
    const allTrackViews = mp4Asset.getTrackViews();

    const videoTracks = allTrackViews.filter(t => t.mediaType === "video");
    const audioTracks = allTrackViews.filter(t => t.mediaType === "audio");

    // -------------------------------------------------
    // TEMPORARY TRACK SELECTION POLICY (APPLICATION-LEVEL)
    // -------------------------------------------------
    const videoTrackView = videoTracks[0];
    const audioTrackView = audioTracks[0];

    if (!videoTrackView) {
        throw new Error("createTimeline: no video track selected");
    }
    if (!audioTrackView) {
        throw new Error("createTimeline: no audio track selected");
    }

    // -------------------------------------------------
    // Assemble Timeline (domain objects only)
    // -------------------------------------------------
    const timeline = new Timeline(30);

    // DEMO ASSUMPTION (TEMPORARY):
    // - timeline.tracks[0] drives video
    // - timeline.tracks[1] drives audio (if present)
    const videoTrack = new Track();
    const audioTrack = new Track();

    timeline.addTrack(videoTrack);
    timeline.addTrack(audioTrack);

    videoTrack.addClip(
        new Clip({
            trackView: videoTrackView,
            startSeconds: 0,
            endSeconds: 10
        })
    );

    audioTrack.addClip(
        new Clip({
            trackView: audioTrackView,
            startSeconds: 0,
            endSeconds: 30
        })
    );

    return timeline;
}

/**
 * Track
 *
 * A Track is a structural grouping of Clips within the Timeline.
 *
 * Tracks define:
 * - ordering of clips
 * - overlap relationships
 * - relative layering when multiple clips are active
 *
 * Tracks do NOT define rendering semantics.
 *
 * In particular:
 * - A Track is not inherently "video", "audio", or "text"
 * - Rendering behavior is determined by the Assets and Clips
 *   placed on the Track, not by the Track itself
 *
 * Track typing, lane constraints, and media-specific rules
 * are editor-level concerns and must not leak into the
 * timeline compiler or pre-render execution.
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Own clip ordering
 * - Provide structural grouping for timeline evaluation
 *
 * INTENTIONALLY OUT OF SCOPE:
 * - Media decoding
 * - Rendering
 * - Mixing or compositing
 * - Output domain decisions
 */
class Track {
    constructor() {
        this.id = createId(); // Engine identity (opaque, stable)
        this.clips = [];
    }

    addClip(clip) {
        this.clips.push(clip);
    }
}


/**
 * Clip
 *
 * A bounded time window over an underlying source
 * (e.g. a ContainerTrackView for container-backed media).
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Define a start/end range in container time
 * - Filter access units that fall within that range
 *
 * INTENTIONALLY OUT OF SCOPE *FOR THIS STAGE*:
 * - Decoding media
 * - Rendering frames
 * - Sampling by wall-clock time
 *
 * NOTES:
 * - Clips do not answer "what happens at time t" at this stage.
 * - They only define which access units belong to the clip.
 * - Later stages interpret these units for render, preview, or export.
 */
class Clip {
    constructor({ trackView, startSeconds, endSeconds }) {
        this.id = createId(); // Engine identity (opaque, stable)
        this.trackView = trackView;
        this.startPts = trackView.secondsToPts(startSeconds);
        this.endPts   = trackView.secondsToPts(endSeconds);
    }

    *iterateAccessUnits() {
        let yielded = false;

        for (const unit of this.trackView.iterateSamplesByPtsRange(
            this.startPts,
            this.endPts
        )) {
            yielded = true;
            yield unit;
        }

        if (!yielded) {
            throw new Error(
                "Clip: no samples exist in referenced time range"
            );
        }
    }
}

/**
 * Asset
 *
 * Abstract base type for all sources referenced by the timeline.
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Represent a source of media or procedural content
 *
 * INTENTIONALLY OUT OF SCOPE *FOR THIS STAGE*:
 * - Time-based sampling
 * - Decoding
 * - Timeline evaluation
 *
 * NOTES:
 * - Different Asset subclasses participate in different stages.
 * - Container-backed assets expose ContainerTrackViews.
 * - Procedural assets (text, images, effects) are evaluated later.
 */
class Asset {
    constructor(filePath) {
        this.id = createId(); // Engine identity (opaque, stable)
        this.filePath = filePath;
        this.data = null;
    }

    // Define a method to be overridden by subclasses
    async load() {
        throw new Error('load method must be implemented by subclass');
    }
}

/**
 * VideoAsset
 *
 * Transitional asset representing a container-backed video source.
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Fetch raw container bytes
 *
 * INTENTIONALLY OUT OF SCOPE *FOR THIS STAGE*:
 * - Frame decoding
 * - Rendering
 * - Timeline evaluation
 *
 * NOTES:
 * - This class exists to bridge preview-era code with
 *   container-driven compilation.
 * - It will shrink or disappear as the pipeline solidifies.
 */
class VideoAsset extends Asset {

    /**
     * Fetch raw MP4 container bytes.
     *
     * Contract:
     * - Uses this.filePath
     * - Fetches once
     * - Stores raw container bytes
     * - Does NOT decode
     * - Does NOT parse tracks
     */
    async fetchRawBytes() {
        console.log(`Fetching raw video data from: ${this.filePath}`);

        const response = await fetch(this.filePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch video asset from ${this.filePath}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`Fetched ${arrayBuffer.byteLength} bytes`);

        this.data = arrayBuffer;
        return this.data;
    }
}

/**
 * AudioAsset
 *
 * Transitional asset representing a container-backed audio source.
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Fetch raw container bytes
 *
 * INTENTIONALLY OUT OF SCOPE *FOR THIS STAGE*:
 * - PCM decoding during compilation
 * - Time-based audio sampling
 *
 * NOTES:
 * - Any decoding here is temporary and will move
 *   into a dedicated decode stage later.
 */
class AudioAsset extends Asset {

    /**
     * Fetch raw audio container bytes.
     *
     * Contract:
     * - Uses this.filePath
     * - Fetches once
     * - Stores raw container bytes or decoded buffer (temporary)
     * - Does NOT provide time-based access
     * - Does NOT participate in timeline evaluation
     *
     * NOTE:
     * Decoding here is transitional and will be removed
     * once audio decoding moves to the prerender stage.
     */
    async fetchRawBytes() {
        console.log(`Fetching raw audio data from: ${this.filePath}`);

        const response = await fetch(this.filePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch audio asset from ${this.filePath}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`Fetched ${arrayBuffer.byteLength} bytes`);

        // TEMPORARY: decoding here will be removed later
        const audioContext = new AudioContext();
        this.data = await audioContext.decodeAudioData(arrayBuffer);

        return this.data;
    }
}

/**
 * Mp4Asset
 *
 * Represents a container-backed media source AFTER demux.
 *
 * Contract:
 * - Owns a set of ContainerTrackViews supplied from below.
 * - Does NOT perform demux.
 * - Does NOT select tracks.
 * - Does NOT assume media types or cardinality.
 *
 * Invariants:
 * - trackViews is an array.
 * - Each entry conforms to the TrackView interface.
 *
 * Notes:
 * - Demux happens below Mp4Asset.
 * - Track selection happens above Mp4Asset.
 */
class Mp4Asset {
    constructor({ trackViews }) {
        this._trackViews = trackViews;
    }

    getTrackViews() {
        return this._trackViews;
    }
}

/**
 * ImageAsset
 *
 * Represents a procedural, non-container visual source.
 *
 * Contract:
 * - Participates in the Timeline via TrackViews, like all other Assets.
 * - Exposes one or more procedural TrackViews via getTrackViews().
 * - Does NOT read container data.
 * - Does NOT produce access units.
 * - Does NOT depend on MP4 semantics.
 *
 * TrackView behavior:
 * - mediaType === "image"
 * - iterateSamplesByPtsRange() yields no samples.
 * - Presence of the TrackView allows Clips to bind time ranges
 *   even though no container-timed samples exist.
 *
 * Architectural purpose:
 * - Keeps the asset → track → clip pipeline uniform.
 * - Avoids special-casing non-container assets in Timeline logic.
 * - Allows future procedural evaluation stages (render graph, effects)
 *   to consume Image tracks without changing Timeline semantics.
 */
class ImageAsset extends Asset {
    constructor({ bitmap }) {
        super();
        this.bitmap = bitmap;
        this._trackViews = null;
    }

    /**
     * Return procedural TrackViews for this asset.
     *
     * @returns {Array<Object>} trackViews
     *
     * Invariants:
     * - Always returns an array.
     * - Returned TrackViews conform to the TrackView interface.
     * - No access units are emitted at this stage.
     */
    getTrackViews() {
        if (this._trackViews) return this._trackViews;

        this._trackViews = [
            {
                mediaType: "image",
                asset: this,

                /**
                 * Procedural image tracks emit no container-timed samples.
                 * Timing is interpreted later by render stages, not here.
                 */
                *iterateSamplesByPtsRange() {
                    // intentionally empty
                }
            }
        ];

        return this._trackViews;
    }
}
/**
 * TextAsset
 *
 * Represents procedural, non-container content.
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Describe layout and animation intent
 *
 * NOTES:
 * - Text does not participate in container compilation.
 * - It is evaluated later as part of render graph execution.
 */
class TextAsset extends Asset {
    constructor({ layout, animations }) {
        super();
        this.layout = layout;
        this.animations = animations;
    }

    getKind() {
        return "procedural";
    }
}


function* evaluateVideoTrack(track) {
    for (const clip of track.clips) {
        yield* clip.iterateAccessUnits();
    }
}

import * as TimelineCompiler from "./src/timeline/compileTimeline.js";

export const __test__ = {
    Timeline,
    Track,
    Clip,
    ...TimelineCompiler
};
