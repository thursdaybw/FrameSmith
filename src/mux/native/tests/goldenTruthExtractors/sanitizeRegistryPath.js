/**
 * Removes bracketed selectors from an MP4 path.
 * 
 * Example:
 *     moov/trak[0]/mdia/minf/stbl/stsd
 * Becomes:
 *     moov/trak/mdia/minf/stbl/stsd
 */
export function stripBracketSelectors(path) {

    /*
     * Regex explanation:
     *  - \[        literal '['
     *  - [^\]]+    one or more non-']' characters
     *  - \]        literal ']'
     *  - g         remove all such segments
     */
    return path.replace(/\[[^\]]+\]/g, "");
}

// stripTrailingSlash.js
//
// Removes a single trailing slash from a path, if present.
// Does NOT modify internal slashes or perform any other normalization.

export function stripTrailingSlash(path) {

    if (typeof path !== "string") {
        throw new Error(
            "stripTrailingSlash: path must be a string\n" +
            `Received: ${Object.prototype.toString.call(path)}`
        );
    }

    if (path.length === 0) {
        return path;
    }

    return path.endsWith("/")
        ? path.slice(0, -1)
        : path;
}
