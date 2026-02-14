import { WebmDemuxRegistry } from "./WebmDemuxRegistry.js";
import { buildWebmSelector } from "../selectors/buildWebmSelector.js";

function extractSegmentInfo() {
    throw new Error("WebM extractor not implemented yet: segment/info");
}

function extractTrackEntry() {
    throw new Error("WebM extractor not implemented yet: segment/tracks/trackEntry");
}

function extractSimpleBlock() {
    throw new Error("WebM extractor not implemented yet: segment/cluster/simpleBlock");
}

let registered = false;

export function registerWebmDemuxExtractors() {
    if (registered) {
        return;
    }

    WebmDemuxRegistry.register(
        buildWebmSelector({ pathSegments: ["segment", "info"] }),
        extractSegmentInfo
    );
    WebmDemuxRegistry.register(
        buildWebmSelector({ pathSegments: ["segment", "tracks", "trackEntry"] }),
        extractTrackEntry
    );
    WebmDemuxRegistry.register(
        buildWebmSelector({ pathSegments: ["segment", "cluster", "simpleBlock"] }),
        extractSimpleBlock
    );

    registered = true;
}

export function resetWebmDemuxRegistryForTests() {
    registered = false;
    WebmDemuxRegistry.clearForTests();
}

