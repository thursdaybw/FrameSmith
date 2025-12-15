// Hardcoded offsets extracted from reference_visual.trace.txt
// These never change because reference_visual.mp4 is frozen.

export const referenceOffsets = {
    avcC: {
        offset: 3994 + 116 + 136 + 85 + 64 + 8,   // moov + trak + mdia + minf + stbl + stsd header
        size: 53 + 8                               // body 53 + header 8
    }
};
