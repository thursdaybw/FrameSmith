import { assertEqual } from "./assertions.js";
import { buildWebmSelector } from "../demux/webm/selectors/buildWebmSelector.js";
import { WebmDemuxRegistry } from "../demux/webm/registry/WebmDemuxRegistry.js";
import {
    registerWebmDemuxExtractors,
    resetWebmDemuxRegistryForTests
} from "../demux/webm/registry/registerWebmDemuxExtractors.js";

export async function test_webm_buildWebmSelector_buildsPathOnlySelector() {
    const selector = buildWebmSelector({
        pathSegments: ["segment", "tracks", "trackEntry"]
    });
    assertEqual("selector path only", selector, "segment/tracks/trackEntry");
}

export async function test_webm_buildWebmSelector_buildsCodecScopedSelector() {
    const selector = buildWebmSelector({
        pathSegments: ["segment", "tracks", "trackEntry"],
        codecSelectorToken: "V_VP9"
    });
    assertEqual("selector path + codec", selector, "segment/tracks/trackEntry|V_VP9");
}

export async function test_webm_demuxRegistry_registerAndGetExtractor() {
    WebmDemuxRegistry.clearForTests();

    const selector = "segment/info";
    const extractor = () => ({ ok: true });
    WebmDemuxRegistry.register(selector, extractor);

    assertEqual("registry has selector", WebmDemuxRegistry.hasExtractor(selector), true);
    assertEqual("registry returns extractor", WebmDemuxRegistry.getExtractor(selector), extractor);
}

export async function test_webm_demuxRegistry_rejectsDuplicateSelectorRegistration() {
    WebmDemuxRegistry.clearForTests();
    const selector = "segment/info";
    WebmDemuxRegistry.register(selector, () => ({}));

    let threw = false;
    try {
        WebmDemuxRegistry.register(selector, () => ({}));
    } catch (error) {
        threw = /already registered/.test(String(error?.message ?? error));
    }
    assertEqual("duplicate selector should throw", threw, true);
}

export async function test_webm_registerWebmDemuxExtractors_registersSkeletonSelectors() {
    resetWebmDemuxRegistryForTests();
    registerWebmDemuxExtractors();

    const selectors = WebmDemuxRegistry.listSelectors().sort();
    assertEqual("registered selector count", selectors.length, 3);
    assertEqual("has segment/info", selectors.includes("segment/info"), true);
    assertEqual(
        "has segment/tracks/trackEntry",
        selectors.includes("segment/tracks/trackEntry"),
        true
    );
    assertEqual(
        "has segment/cluster/simpleBlock",
        selectors.includes("segment/cluster/simpleBlock"),
        true
    );
}

export const WEBM_SELECTOR_REGISTRY_TESTS = [
    test_webm_buildWebmSelector_buildsPathOnlySelector,
    test_webm_buildWebmSelector_buildsCodecScopedSelector,
    test_webm_demuxRegistry_registerAndGetExtractor,
    test_webm_demuxRegistry_rejectsDuplicateSelectorRegistration,
    test_webm_registerWebmDemuxExtractors_registersSkeletonSelectors
];

