import { WebmDemuxRegistry } from "./WebmDemuxRegistry.js";
import { buildWebmSelector } from "../selectors/buildWebmSelector.js";
import { extractSegmentInfo } from "../extractors/segment/extractSegmentInfo.js";
import { extractTrackEntry } from "../extractors/tracks/extractTrackEntry.js";
import { extractSimpleBlock } from "../extractors/cluster/extractSimpleBlock.js";

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
