function toEven(value) {
    const rounded = Math.max(2, Math.round(value));
    return rounded % 2 === 0 ? rounded : rounded - 1;
}

function fitWithinBounds({ width, height, maxWidth, maxHeight }) {
    if (!(width > 0) || !(height > 0)) {
        return { width: toEven(maxWidth), height: toEven(maxHeight) };
    }
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    return {
        width: toEven(width * scale),
        height: toEven(height * scale)
    };
}

function uniqueResolutions(items) {
    const out = [];
    const seen = new Set();
    for (const item of items) {
        const key = `${item.width}x${item.height}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

export function deriveDisplayDimensionsFromTrackView(videoTrackView) {
    const codedWidth =
        videoTrackView?.containerMeta?.codedWidth ??
        videoTrackView?.codecConfig?.codedWidth ??
        1080;
    const codedHeight =
        videoTrackView?.containerMeta?.codedHeight ??
        videoTrackView?.codecConfig?.codedHeight ??
        1920;
    const rotationDegrees = Number(
        videoTrackView?.containerMeta?.displayTransform?.rotationDegrees ?? 0
    );
    const isQuarterTurn = rotationDegrees === 90 || rotationDegrees === 270;
    const displayWidth = isQuarterTurn ? codedHeight : codedWidth;
    const displayHeight = isQuarterTurn ? codedWidth : codedHeight;

    return {
        codedWidth,
        codedHeight,
        rotationDegrees,
        displayWidth,
        displayHeight
    };
}

export function deriveVideoEncoderResolutionLadderFromTrackView(videoTrackView) {
    const { displayWidth, displayHeight } = deriveDisplayDimensionsFromTrackView(videoTrackView);
    const sourceAspect = displayWidth > 0 && displayHeight > 0
        ? displayWidth / displayHeight
        : (16 / 9);

    const makeResolutionFromHeight = (height) => {
        const h = toEven(height);
        const w = toEven(h * sourceAspect);
        return { width: w, height: h };
    };

    const prefersPortrait = displayHeight >= displayWidth;
    const baseBounds = prefersPortrait
        ? { maxWidth: 1080, maxHeight: 1920 }
        : { maxWidth: 1920, maxHeight: 1080 };
    const baseResolution = fitWithinBounds({
        width: displayWidth,
        height: displayHeight,
        ...baseBounds
    });

    return uniqueResolutions([
        baseResolution,
        makeResolutionFromHeight(1280),
        makeResolutionFromHeight(960),
        makeResolutionFromHeight(720),
        makeResolutionFromHeight(540),
        { width: 640, height: 360 }
    ]);
}

