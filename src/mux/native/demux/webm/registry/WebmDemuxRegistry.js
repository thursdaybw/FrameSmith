function assertSelector(selector) {
    if (typeof selector !== "string" || selector.trim().length === 0) {
        throw new Error("WebmDemuxRegistry: selector must be a non-empty string");
    }
}

function assertExtractor(extractor, selector) {
    if (typeof extractor !== "function") {
        throw new Error(
            `WebmDemuxRegistry: extractor for selector '${selector}' must be a function`
        );
    }
}

const EXTRACTORS = new Map();

export const WebmDemuxRegistry = {
    register(selector, extractor) {
        assertSelector(selector);
        assertExtractor(extractor, selector);
        if (EXTRACTORS.has(selector)) {
            throw new Error(`WebmDemuxRegistry: selector '${selector}' is already registered`);
        }
        EXTRACTORS.set(selector, extractor);
    },

    getExtractor(selector) {
        assertSelector(selector);
        return EXTRACTORS.get(selector) ?? null;
    },

    hasExtractor(selector) {
        assertSelector(selector);
        return EXTRACTORS.has(selector);
    },

    listSelectors() {
        return [...EXTRACTORS.keys()];
    },

    clearForTests() {
        EXTRACTORS.clear();
    }
};

