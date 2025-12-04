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

import { drawCaptionForTime } from "./captionRenderer.js";

document.addEventListener("DOMContentLoaded", () => {

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


  const video = document.getElementById("v");
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  document.getElementById("run").onclick = async () => {
    await video.play().catch(console.error);

    await new Promise(resolve => {
      if (video.readyState >= 1) return resolve();
      video.onloadedmetadata = resolve;
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

      drawCaptionForTime(video.currentTime, ctx, canvas, captions, "default");

      requestAnimationFrame(loop);
    }

    loop();
  };

window.debugSetTime = (t) => {
  video.currentTime = t;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCaptionForTime(t, ctx, canvas, captions, "default");
};

});

