/**
 * APPLICATION DRIVER — ARCHITECTURE NOTES
 * ---------------------------------------
 * This file wires the pieces together:
 *
 *   - Loads the video
 *   - Captures frames using MediaStreamTrackProcessor
 *   - Calls captionRenderer with current time
 *   - Runs the preview loop
 *
 * It MUST NOT:
 *   - contain styling rules
 *   - contain layout logic
 *   - mutate caption data
 *   - perform drawing beyond orchestrating modules
 *
 * FUTURE DIRECTION:
 *   When export arrives:
 *      - script.js will also run an offline render loop
 *        using the same renderer + layout pipeline.
 *
 *   When audio extraction + transcription arrives:
 *      - script.js will send audio to backend and then
 *        build captions via captionModel.
 */

import { whisperToCaptionSegments } from "./captionModel.js";
import { drawCaptions } from "./captionRenderer.js";

document.addEventListener("DOMContentLoaded", () => {

  const video = document.getElementById("v");
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  let captionSegments = [];

  // --- Load real whisper JSON ---
  fetch("sampleWhisper.json")
    .then(r => r.json())
    .then(json => {
      captionSegments = whisperToCaptionSegments(json);
    });


  document.getElementById("run").onclick = async () => {

    await video.play().catch(console.error);
    await new Promise(r => {
      if (video.readyState >= 1) return r();
      video.onloadedmetadata = r;
    });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const track = video.captureStream().getVideoTracks()[0];
    const processor = new MediaStreamTrackProcessor({ track });
    const reader = processor.readable.getReader();

    async function loop() {
      const { value: frame, done } = await reader.read();
      if (done || !frame) return;

      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      frame.close();

      drawCaptions(ctx, canvas, captionSegments, video.currentTime);

      requestAnimationFrame(loop);
    }

    loop();
  };
});

