/**
 * Application driver.
 *
 * Responsibility:
 *   - Orchestrate video playback
 *   - Run preview playbackRenderLoop
 *   - Forward time and context to renderer
 *
 * Does NOT:
 *   - Perform layout
 *   - Handle style resolution
 *   - Contain visual rules
 */
import { drawCaptionForTime } from "./captionRenderer.js";
import { createRenderPlan, createImageNode } from "./renderPlan/RenderPlan.js";
import { renderFrame } from "./renderPlan/RenderPlanRenderer.js";
import { ExportEngine } from "./export/ExportEngine.js";
import { Mp4BoxDemuxer } from "./src/demux/Mp4BoxDemuxer.js"
import { Mp4BoxMuxer} from "./src/mux/Mp4BoxMuxer.js";

document.addEventListener("DOMContentLoaded", () => {

  const renderPlan = createRenderPlan();
  const exportBtn = document.getElementById("export");

  const logoImg = new Image();
  logoImg.src = "./logo.png"; // replace with your file

  const video = document.getElementById("v");
  const canvas = document.getElementById("c");
  const context = canvas.getContext("2d");

  // captions hard-coded temporary
  // TEMPORARY: synthetic caption list (until Whisper import)
      /*
  const captions = [
    {
      start: 0.0,
      end: 0.86,
      text: "Do you know what hit me today?",
      words: [
        { start: 0.0, end: 0.12, text: "Do" },
        { start: 0.12, end: 0.14, text: "you" },
        { start: 0.14, end: 0.24, text: "know" },
        { start: 0.24, end: 0.32, text: "what" },
        { start: 0.32, end: 0.46, text: "hit" },
        { start: 0.46, end: 0.58, text: "me" },
        { start: 0.58, end: 0.86, text: "today?" }
      ]
    },
    {
      start: 1.24,
      end: 5.72,
      text: "It's how many eBay businesses are killed by fear.",
      words: [
        { start: 1.24, end: 1.46, text: "It's" },
        { start: 1.46, end: 1.72, text: "how" },
        { start: 1.72, end: 2.06, text: "many" },
        { start: 2.06, end: 2.88, text: "eBay" },
        { start: 2.88, end: 3.48, text: "businesses", override: ["pulse"] },
        { start: 3.48, end: 4.28, text: "are" },
        { start: 4.28, end: 4.66, text: "killed" },
        { start: 4.66, end: 5.16, text: "by" },
        { start: 5.16, end: 5.72, text: "fear." }
      ]
    },
      {
          start: 0,
          end: 30,
          text: "Testing animation inside the caption renderer",
          words: [
              {
                  start: 0,
                  end: 30,
                  text: "Testing",
                  override: ["pulse"]
              }
          ]
      }
  ];    
*/

    const captions = [
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


  document.getElementById("run").onclick = async () => {
    await video.play().catch(console.error);

    await new Promise(resolve => {
      if (video.readyState >= 1) return resolve();
      video.onloadedmetadata = resolve;
    });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Now that video metadata is loaded, scale the logo correctly
    const targetWidth = canvas.width * 0.30;  // 30% of video width
    const aspect = logoImg.naturalHeight / logoImg.naturalWidth;
    const targetHeight = targetWidth * aspect;

    renderPlan.elements.push(
      createImageNode(logoImg, 20, 20, targetWidth, targetHeight)
    );


    const track = video.captureStream().getVideoTracks()[0];
    const processor = new MediaStreamTrackProcessor({ track });
    const reader = processor.readable.getReader();

    // Audio track setup for export
    const audioTrack = video.captureStream().getAudioTracks()[0];
    if (audioTrack) {
        console.log("audioTrack:", audioTrack);
        console.log("audio settings:", audioTrack.getSettings());
        console.log("audio constraints:", audioTrack.getConstraints());
    }

      async function playbackRenderLoop() {
          const { value: frame, done } = await reader.read();
          if (done || !frame) return;

          // Compose full frame (video + overlays + captions)
          renderFrame({
              videoFrame: frame,
              renderPlan,
              captions,
              context,
              canvas,
              t: video.currentTime
          });

          // Encode the composed frame
          const timestamp = Math.floor(video.currentTime * 1_000_000); // microseconds

          frame.close();

          requestAnimationFrame(playbackRenderLoop);
      }

    playbackRenderLoop();
  };

    // -------------------------------------------------------------
    // EXPORT BUTTON — lazy initialization of ExportEngine
    // -------------------------------------------------------------
    exportBtn.onclick = async () => {
        console.log("Starting export...");

        // Load file bytes
        const response = await fetch(video.src);
        console.log("onclick A");
        const arrayBuffer = await response.arrayBuffer();
        console.log("arrayBuffer.byteLength =", arrayBuffer.byteLength);
        console.log("onclick B");

        // Create demuxer
        const demuxer = new Mp4BoxDemuxer(arrayBuffer);
        console.log("onclick C");

        // Create muxer (NEW)
        const muxer = new Mp4BoxMuxer({
            videoTrackInfo: demuxer.getVideoTrackInfo(),
            audioTrackInfo: demuxer.getAudioTrackInfo()
        });

        // Create export engine
        const exportEngine = new ExportEngine({
            demuxer,
            fps: 30,
            renderPlan,
            captions,
            muxer
        });

        console.log("onclick D");
        // Load samples from demuxer
        await exportEngine.load();

        // Run export
        console.log("onclick E");
        await exportEngine.export();   // run decode → composite → encode
        console.log("onclick F");
        const blob = exportEngine.getFinalBlob();
        console.log("onclick G");
        console.log("blob size =", blob.size);
        //downloadBlob(blob, "framesmith.mp4");
        downloadBlob(blob, "framesmith.h264");

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
