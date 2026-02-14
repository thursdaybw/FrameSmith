import {
    deriveDisplayDimensionsFromTrackView,
    deriveVideoEncoderResolutionLadderFromTrackView
} from "./deriveVideoEncoderResolutionLadderFromTrackView.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export function test_deriveDisplayDimensionsFromTrackView_appliesQuarterTurnRotation() {
    const info = deriveDisplayDimensionsFromTrackView({
        containerMeta: {
            codedWidth: 3648,
            codedHeight: 2048,
            displayTransform: { rotationDegrees: 90 }
        }
    });

    assert(info.displayWidth === 2048, "display width should swap when rotated 90");
    assert(info.displayHeight === 3648, "display height should swap when rotated 90");
}

export function test_deriveVideoEncoderResolutionLadderFromTrackView_prefersPortraitBoundsWhenDisplayIsPortrait() {
    const ladder = deriveVideoEncoderResolutionLadderFromTrackView({
        containerMeta: {
            codedWidth: 3648,
            codedHeight: 2048,
            displayTransform: { rotationDegrees: 90 }
        }
    });

    const first = ladder[0];
    assert(first.width <= first.height, "portrait display should choose portrait base resolution");
    assert(first.width <= 1080, "portrait base width should be bounded by 1080");
    assert(first.height <= 1920, "portrait base height should be bounded by 1920");
}

export function test_deriveVideoEncoderResolutionLadderFromTrackView_prefersLandscapeBoundsWhenDisplayIsLandscape() {
    const ladder = deriveVideoEncoderResolutionLadderFromTrackView({
        containerMeta: {
            codedWidth: 1920,
            codedHeight: 1080,
            displayTransform: { rotationDegrees: 0 }
        }
    });

    const first = ladder[0];
    assert(first.width >= first.height, "landscape display should choose landscape base resolution");
    assert(first.width <= 1920, "landscape base width should be bounded by 1920");
    assert(first.height <= 1080, "landscape base height should be bounded by 1080");
}

export function test_deriveVideoEncoderResolutionLadderFromTrackView_hasUniqueResolutions() {
    const ladder = deriveVideoEncoderResolutionLadderFromTrackView({
        containerMeta: {
            codedWidth: 1080,
            codedHeight: 1920,
            displayTransform: { rotationDegrees: 0 }
        }
    });

    const keys = ladder.map((item) => `${item.width}x${item.height}`);
    const uniqueCount = new Set(keys).size;
    assert(uniqueCount === keys.length, "resolution ladder should be de-duplicated");
}

export const DERIVE_VIDEO_ENCODER_RESOLUTION_LADDER_TESTS = [
    test_deriveDisplayDimensionsFromTrackView_appliesQuarterTurnRotation,
    test_deriveVideoEncoderResolutionLadderFromTrackView_prefersPortraitBoundsWhenDisplayIsPortrait,
    test_deriveVideoEncoderResolutionLadderFromTrackView_prefersLandscapeBoundsWhenDisplayIsLandscape,
    test_deriveVideoEncoderResolutionLadderFromTrackView_hasUniqueResolutions
];

