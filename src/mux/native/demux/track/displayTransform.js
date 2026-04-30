const IDENTITY_MATRIX = Object.freeze([
    65536, 0, 0,
    0, 65536, 0,
    0, 0, 1073741824
]);

function toSignedInt32(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return numeric > 0x7fffffff ? numeric - 0x100000000 : numeric | 0;
}

function normalizeQuarterTurnDegrees(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    const normalized = ((Math.round(numeric / 90) * 90) % 360 + 360) % 360;
    if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
    return 0;
}

function inferQuarterTurnRotationDegreesFromMatrix(matrix) {
    const a = toSignedInt32(matrix[0]) / 65536;
    const b = toSignedInt32(matrix[1]) / 65536;
    const c = toSignedInt32(matrix[3]) / 65536;
    const d = toSignedInt32(matrix[4]) / 65536;

    const near = (lhs, rhs, epsilon = 0.35) => Math.abs(lhs - rhs) <= epsilon;

    if (near(a, 1) && near(b, 0) && near(c, 0) && near(d, 1)) return 0;
    if (near(a, 0) && near(b, 1) && near(c, -1) && near(d, 0)) return 90;
    if (near(a, -1) && near(b, 0) && near(c, 0) && near(d, -1)) return 180;
    if (near(a, 0) && near(b, -1) && near(c, 1) && near(d, 0)) return 270;

    const fallbackDegrees = Math.atan2(b, a) * (180 / Math.PI);
    return normalizeQuarterTurnDegrees(fallbackDegrees);
}

export function buildDisplayTransformFromTrackMatrix(matrix) {
    const normalizedMatrix =
        Array.isArray(matrix) && matrix.length >= 9
            ? matrix.slice(0, 9).map(entry => toSignedInt32(entry))
            : Array.from(IDENTITY_MATRIX);

    const a = normalizedMatrix[0] / 65536;
    const b = normalizedMatrix[1] / 65536;
    const c = normalizedMatrix[3] / 65536;
    const d = normalizedMatrix[4] / 65536;
    const x = normalizedMatrix[6] / 65536;
    const y = normalizedMatrix[7] / 65536;

    return {
        rotationDegrees: inferQuarterTurnRotationDegreesFromMatrix(normalizedMatrix),
        scaleX: Math.hypot(a, b),
        scaleY: Math.hypot(c, d),
        translateX: x,
        translateY: y,
        matrix: normalizedMatrix
    };
}

export function buildDisplayTransformFromTkhdFields(fields) {
    const matrix = [
        fields?.matrix_a,
        fields?.matrix_b,
        fields?.matrix_u,
        fields?.matrix_c,
        fields?.matrix_d,
        fields?.matrix_v,
        fields?.matrix_x,
        fields?.matrix_y,
        fields?.matrix_w
    ];
    return buildDisplayTransformFromTrackMatrix(matrix);
}

