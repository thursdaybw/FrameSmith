import { resolveStcoOffsetsPerTrack } from "../layout/resolveStcoOffsetsPerTrack.js";
import { assertEqual, assertExists } from "./assertions.js";

export function testResolveStcoOffsetsPerTrack_BasicLayoutResolution() {

    // ---------------------------------------------------------
    // Arrange
    // ---------------------------------------------------------

    const tracks = [
        { trackId: 0 }, // video
        { trackId: 1 }  // audio
    ];

    const mdatBoxStartOffset = 1000;
    const MDAT_HEADER_SIZE = 8;

    const mdatChunkLayout = [
        {
            trackIndex: 1,
            offsetWithinMdat: 0,
            byteLength: 200
        },
        {
            trackIndex: 0,
            offsetWithinMdat: 200,
            byteLength: 500
        },
        {
            trackIndex: 1,
            offsetWithinMdat: 700,
            byteLength: 180
        }
    ];

    // ---------------------------------------------------------
    // Act
    // ---------------------------------------------------------

    const perTrackOffsets = resolveStcoOffsetsPerTrack({
        tracks,
        mdatChunkLayout,
        mdatStartOffset: mdatBoxStartOffset
    });

    // ---------------------------------------------------------
    // Assert — shape
    // ---------------------------------------------------------

    assertExists("perTrackOffsets exists", perTrackOffsets);
    assertEqual("one array per track", perTrackOffsets.length, 2);

    assertEqual("track 0 offsets is array", Array.isArray(perTrackOffsets[0]), true);
    assertEqual("track 1 offsets is array", Array.isArray(perTrackOffsets[1]), true);

    // ---------------------------------------------------------
    // Assert — values
    // ---------------------------------------------------------

    // track 0 (video)
    assertEqual("track 0 has one chunk", perTrackOffsets[0].length, 1);

    assertEqual(
        "track 0 offset is absolute (box + header + payload)",
        perTrackOffsets[0][0],
        mdatBoxStartOffset + MDAT_HEADER_SIZE + 200
    );

    // track 1 (audio)
    assertEqual("track 1 has two chunks", perTrackOffsets[1].length, 2);

    assertEqual(
        "track 1 first offset",
        perTrackOffsets[1][0],
        mdatBoxStartOffset + MDAT_HEADER_SIZE + 0
    );

    assertEqual(
        "track 1 second offset",
        perTrackOffsets[1][1],
        mdatBoxStartOffset + MDAT_HEADER_SIZE + 700
    );
}
