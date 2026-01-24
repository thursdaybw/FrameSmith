/**
 * ResolvedBox
 * ===========
 *
 * A structurally resolved MP4 box.
 * Traversal is complete.
 */
export function createResolvedBox({
    registryPath,
    bytes,
    containingTrack,
    sourcePath
}) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("ResolvedBox.bytes must be Uint8Array");
    }

    return Object.freeze({
        registryPath,
        bytes,
        containingTrack,
        sourcePath
    });
}
