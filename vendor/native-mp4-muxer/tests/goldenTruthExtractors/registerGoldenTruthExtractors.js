// registerGoldenTruthExtractors.js
//
// Performs registry mutation.
// This is a startup-time concern.

import { EXTRACTOR_WIRING } from "./GoldenTruthExtractorWiring.js";

export function registerGoldenTruthExtractors(registry) {
    for (const [path, installer] of EXTRACTOR_WIRING) {
        registry.registerExtractor(path, installer);
    }
}
