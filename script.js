/**
 * Application driver.
 *
 * Responsibility:
 *   - Orchestrate video playback
 *   - Run preview loop
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

document.addEventListener("DOMContentLoaded", () => {

  let exportEngine = null;

  const renderPlan = createRenderPlan();
  const exportBtn = document.getElementById("export");

  const logoImg = new Image();
  logoImg.src = "./logo.png"; // replace with your file

  const video = document.getElementById("v");
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

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

      async function loop() {
          const { value: frame, done } = await reader.read();
          if (done || !frame) return;

          // Compose full frame (video + overlays + captions)
          renderFrame({
              videoFrame: frame,
              renderPlan,
              captions,
              ctx,
              canvas,
              t: video.currentTime
          });

          // Encode the composed frame
          const timestamp = Math.floor(video.currentTime * 1_000_000); // microseconds

          frame.close();

          requestAnimationFrame(loop);
      }

    loop();
  };

    exportBtn.onclick = async () => {
        if (!exportEngine) {
            console.warn("ExportEngine not initialized. Click Run first.");
            return;
        }

        console.log("Finalizing export...");
        const mp4 = await exportEngine.finalize();
        downloadBlob(mp4, "framesmith_output.mp4");
    };

    window.debugSetTime = (t) => {
        video.currentTime = t;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCaptionForTime(t, ctx, canvas, captions, "default");
    };

});

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
