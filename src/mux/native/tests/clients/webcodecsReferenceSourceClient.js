/**
 * WebCodecs Test Client
 * ====================
 *
 * Supplies a Mp4BuildInput by running WebCodecs and mapping
 * encoder-emitted facts into the compiler input contract.
 *
 * This is NOT production code.
 * This client simulates an application using WebCodecs.
 */

export async function runWebCodecsTestClient() {
    const codedWidth = 64;
    const codedHeight = 64;
    const trackTimescale = 1_000_000;

    const frames =
        createDeterministicTestVideoFrames(
            codedWidth,
            codedHeight
        );

    const webcodecsOutput =
        await runWebCodecsRunner({
            codec: "avc1.42E01E",
            width: codedWidth,
            height: codedHeight,
            bitrate: 500_000,
            framerate: 30,
            frames
        });

    return buildMp4BuildInputFromWebCodecs({
        webcodecsOutput,
        buildParameters: {
            codedWidth,
            codedHeight,
            trackTimescale
        }
    });
}

/**
 * Runs WebCodecs and returns raw encoder output.
 * Knows NOTHING about MP4 or container structure.
 */
async function runWebCodecsRunner({
    codec,
    width,
    height,
    bitrate,
    framerate,
    frames
}) {
    const encodedChunks = [];
    let decoderConfig = null;

    const encoder = new VideoEncoder({
        output(chunk, meta) {
            encodedChunks.push(chunk);
            if (meta?.decoderConfig && decoderConfig === null) {
                decoderConfig = meta.decoderConfig;
            }
        },
        error(e) {
            throw e;
        }
    });

    encoder.configure({
        codec,
        width,
        height,
        bitrate,
        framerate
    });

    for (const frame of frames) {
        encoder.encode(frame);
        frame.close();
    }

    await encoder.flush();
    encoder.close();

    return {
        encodedChunks,
        decoderConfig
    };
}

/**
 * Maps WebCodecs output into Mp4BuildInput.
 *
 * This client:
 *   - owns intent
 *   - supplies identity if desired
 *   - does not apply container policy
 */
function buildMp4BuildInputFromWebCodecs({
    webcodecsOutput,
    buildParameters,
    semanticHints,
    buildHints
}) {
    const { encodedChunks, decoderConfig } = webcodecsOutput;

    const accessUnits = [];
    const accessUnitPayloads = [];

    for (const chunk of encodedChunks) {
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);

        accessUnitPayloads.push(bytes);
        accessUnits.push({
            pts: chunk.timestamp,
            isKey: chunk.type === "key"
        });
    }

    return {
        semanticCore: {
            accessUnits,
            codec: {
                codec: decoderConfig.codec,
                avcC: new Uint8Array(decoderConfig.description),
                avcCCompleteness: "semantic"
            }
        },

        payloads: {
            accessUnitPayloads
        },

        semanticHints,
        buildParameters,
        buildHints
    };
}

/**
 * Deterministic frame factory for the test client.
 */
function createDeterministicTestVideoFramesoff(width, height) {
    const frameCount = 4;
    const frameDurationUs = 33_333;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    return Array.from({ length: frameCount }, (_, i) =>
        new VideoFrame(canvas, {
            timestamp: i * frameDurationUs
        })
    );
}


function createDeterministicTestVideoFrames(width, height) {
    const fps = 30;
    const seconds = 6;                 // long enough to observe
    const frameCount = fps * seconds;
    const frameDurationUs = Math.floor(1_000_000 / fps);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const frames = [];

    for (let i = 0; i < frameCount; i++) {
        const t = i / fps;

        // -------------------------------------------------
        // Background color blocks (2-second phases)
        // -------------------------------------------------
        if (t < 2) {
            ctx.fillStyle = "red";
        } else if (t < 4) {
            ctx.fillStyle = "blue";
        } else {
            ctx.fillStyle = "green";
        }

        ctx.fillRect(0, 0, width, height);

        // -------------------------------------------------
        // Moving white square (motion proof)
        // -------------------------------------------------
        const squareSize = Math.floor(width / 6);
        const x =
            Math.floor(
                (width - squareSize) *
                ((i % fps) / (fps - 1))
            );

        const y =
            Math.floor(height / 2 - squareSize / 2);

        ctx.fillStyle = "white";
        ctx.fillRect(x, y, squareSize, squareSize);

        frames.push(
            new VideoFrame(canvas, {
                timestamp: i * frameDurationUs
            })
        );
    }

    return frames;
}
