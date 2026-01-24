export const videoPresets = {
    countdown720p60: {
        codec: "avc1.4D401F",
        width: 1280,
        height: 720,
        fps: 60,
        bitrate: 500_000,
        durationSeconds: 10
    }
};

export const audioPresets = {
    opusStereo48k: {
        codec: "opus",
        sampleRate: 48_000,
        numberOfChannels: 2,
        bitrate: 128_000,
        durationSeconds: 10
    }
};
