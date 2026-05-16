/**
 * Runs WebCodecs AudioEncoder and returns raw encoder output.
 * Knows NOTHING about MP4 or container structure.
 */
export async function runWebCodecsAudioRunner({
    codec,
    sampleRate,
    numberOfChannels,
    bitrate,
    audioDataFrames
}) {
    const encodedChunks = [];
    let decoderConfig = null;

    const encoder = new AudioEncoder({
        output(chunk, meta) {
            encodedChunks.push(chunk);

            if (meta?.decoderConfig && decoderConfig === null) {
                decoderConfig = meta.decoderConfig;
            }
        },
        error(error) {
            throw error;
        }
    });

    encoder.configure({
        codec,
        sampleRate,
        numberOfChannels,
        bitrate
    });

    for (const audioData of audioDataFrames) {
        encoder.encode(audioData);
        audioData.close();
    }

    await encoder.flush();
    encoder.close();

    return {
        encodedChunks,
        decoderConfig
    };
}
