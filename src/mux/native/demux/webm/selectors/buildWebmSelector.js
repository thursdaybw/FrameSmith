function normalizePathSegments(pathSegments) {
    if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
        throw new Error("buildWebmSelector: pathSegments must be a non-empty array");
    }

    const normalized = [];
    for (const rawSegment of pathSegments) {
        if (typeof rawSegment !== "string") {
            throw new Error("buildWebmSelector: each path segment must be a string");
        }
        const segment = rawSegment.trim();
        if (segment.length === 0) {
            throw new Error("buildWebmSelector: path segments cannot be empty");
        }
        if (segment.includes("/")) {
            throw new Error("buildWebmSelector: path segments cannot contain '/'");
        }
        normalized.push(segment);
    }
    return normalized;
}

function normalizeCodecSelectorToken(codecSelectorToken) {
    if (codecSelectorToken === undefined || codecSelectorToken === null) {
        return "";
    }
    if (typeof codecSelectorToken !== "string") {
        throw new Error("buildWebmSelector: codecSelectorToken must be a string when provided");
    }
    const normalized = codecSelectorToken.trim();
    if (normalized.includes("/")) {
        throw new Error("buildWebmSelector: codecSelectorToken cannot contain '/'");
    }
    return normalized;
}

export function buildWebmSelector({
    pathSegments,
    codecSelectorToken
} = {}) {
    const normalizedSegments = normalizePathSegments(pathSegments);
    const basePath = normalizedSegments.join("/");
    const normalizedCodecToken = normalizeCodecSelectorToken(codecSelectorToken);

    if (normalizedCodecToken.length === 0) {
        return basePath;
    }
    return `${basePath}|${normalizedCodecToken}`;
}

