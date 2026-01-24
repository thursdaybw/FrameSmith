// GoldenTruthFinalizer.js
// GoldenTruthFinalizer.js
//
// Responsible for:
// - Final GoldenTruth façade shaping
// - Extractor invocation
//
// Path resolution is completed upstream.
// Dispatchers no longer exist.
import { getGoldenTruthBox } from "./index.js";
import { GoldenTruthRegistry } from "./GoldenTruthRegistry.js";

export const GoldenTruthFinalizer = {

    finalize({
        registryPath,
        boxBytes,
        containingTrack,
        mp4Bytes,
        path,
        options
    }) {

        return this.buildFacade({
            registryPath,
            bytes: boxBytes,
            options,
            trakBytes: containingTrack
        });

    },

    buildFacade({
        registryPath,
        bytes,
        options,
        trakBytes
    }) {
        const extractor =
            GoldenTruthRegistry.getExtractor(registryPath);

        if (!extractor) {
            throw new Error(
                `No extractor registered for ${registryPath}`
            );
        }

        return {

            readBoxReport() {
                return extractor.readBoxReport(bytes);
            },

            getEmitterInput() {
                return extractor.getEmitterInput(bytes);
            }
        };
    }

};

function normalizeRegistryPath(registryPath) {

    // Strip STSD structural prefix for SampleEntry resolution
    const stsdPrefix = "moov/trak/mdia/minf/stbl/stsd/";

    if (registryPath.startsWith(stsdPrefix)) {
        return registryPath.slice(stsdPrefix.length);
    }
    return registryPath;
}
