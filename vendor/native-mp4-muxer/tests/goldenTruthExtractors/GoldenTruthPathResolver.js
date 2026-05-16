import {
    asIsoBoxContainer
} from "../../box-model/Box.js";

import {
    getSampleEntryTableFromStsdAsList
} from "../../reference/getSampleEntryTableFromStsdAsList.js";

import {
    getSampleEntryHeaderSize
} from "../../reference/SampleEntryReader.js";

import { SampleEntryCursor } from "../../reference/SampleEntryCursor.js";

import {
    stripBracketSelectors ,
    stripTrailingSlash,
} from "./sanitizeRegistryPath.js";

import {
    enforceRootPathGrammar
} from "./enforceRootPathGrammar.js";

import { GoldenTruthRegistry } from "./GoldenTruthRegistry.js";
import { getGoldenTruthBox } from "./index.js";

// GoldenTruthPathResolver.js
//
// Pure path → bytes resolution.
// No registry.
// No dispatch.
// No extractors.


/**
 * Resolve a concrete Sample Entry from a trak using indexed grammar.
 *
 * Grammar supported:
 *   stsd/sample[n]
 *
 * This function is:
 *   - structural
 *   - index-based
 *   - schema-agnostic
 *
 * It does NOT:
 *   - infer codec types
 *   - consult hdlr
 *   - accept legacy selectors
 */
export function resolveSampleEntryFromTrak(trakBytes, remainingPath) {

    // -------------------------------------------------------------
    // Normalize path to stsd-relative form
    // -------------------------------------------------------------
    let path = remainingPath;

    if (path.startsWith("mdia/minf/stbl/")) {
        path = path.slice("mdia/minf/stbl/".length);
    }

    if (!path.startsWith("stsd/sample[")) {
        throw new Error(
            `resolveSampleEntryFromTrak expects 'stsd/sample[n]', got '${remainingPath}'`
        );
    }

    // -------------------------------------------------------------
    // Parse sample index
    // -------------------------------------------------------------
    const match = path.match(/^stsd\/sample\[(\d+)\](?:\/(.*))?$/);

    if (!match) {
        throw new Error(
            `Invalid sample selector syntax: '${remainingPath}'`
        );
    }

    const sampleIndex = Number(match[1]);
    const childPath = match[2] || null;

    // -------------------------------------------------------------
    // Locate STSD box
    // -------------------------------------------------------------

    const stsdBoxes = findTraversalNodesByPathFromBoxBytes({
            boxBytes: trakBytes,
            path: "mdia/minf/stbl/stsd",
            baseRegistryPath: "moov/trak"
        });

    if (stsdBoxes.length !== 1) {
        throw new Error(
            `Expected exactly one stsd box in trak, found ${stsdBoxes.length}`
        );
    }

    const stsdBytes = stsdBoxes[0].boxBytes;
    const stsdRegistryPath = "moov/trak/mdia/minf/stbl/stsd";

    if (!stsdBytes) {
        throw new Error("stsd box not found in trak");
    }

    // -------------------------------------------------------------
    // Enumerate sample entries structurally
    // -------------------------------------------------------------
    const sampleEntries =
        getSampleEntryTableFromStsdAsList(stsdBytes);

    if (sampleIndex < 0 || sampleIndex >= sampleEntries.length) {
        throw new Error(
            `sample[${sampleIndex}] out of range (found ${sampleEntries.length} sample entries)`
        );
    }

    const entry = sampleEntries[sampleIndex];

    const sampleEntryBytes =
        stsdBytes.slice(
            entry.offset,
            entry.offset + entry.size
        );

    const codec = entry.type;

    // -------------------------------------------------------------
    // Terminal SampleEntry selector allowed
    // -------------------------------------------------------------
    if (!childPath) {
        return {
            sampleEntryBytes,
            sampleEntryIndex: sampleIndex,
            codec,
            registryPath: `moov/trak/mdia/minf/stbl/stsd/${codec}`
        };
    }

    // -------------------------------------------------------------
    // If caller wants a child box, defer traversal upward
    // -------------------------------------------------------------
    if (childPath) {
        return {
            sampleEntryBytes,
            sampleEntryIndex: sampleIndex,
            codec,
            remainingPath: childPath,
            registryPath: `${stsdRegistryPath}/${childPath}`
        };
    }

    return {
        sampleEntryBytes,
        sampleEntryIndex: sampleIndex,
        codec
    };
}


// @internal
export function findTraversalNodesByPathFromBoxBytes({

    boxBytes,
    path,
    baseRegistryPath
}) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("findTraversalNodesByPathFromBoxBytes: expected Uint8Array");
    }

    if (typeof path !== "string" || path.length === 0) {
        throw new Error("findTraversalNodesByPathFromBoxBytes: path must be a non-empty string");
    }

    if (!baseRegistryPath) {
        throw new Error(
            "findTraversalNodesByPathFromBoxBytes: baseRegistryPath is required"
        );
    }

    const segments = path.split("/");

    let current = [{
        bytes: boxBytes,
        registryPath: baseRegistryPath
    }];

    for (const segment of segments) {
        const next = [];

        let segmentName = segment;
        let segmentIndex = null;

        const match = segment.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/);
        if (match) {
            segmentName = match[1];
            segmentIndex = Number(match[2]);
        }

        for (const { bytes, registryPath } of current) {
            const container = asIsoBoxContainer(bytes, registryPath);
            const children = container.enumerateChildren();

            for (const child of children) {
                if (child.type === segmentName) {
                    const childBytes = bytes.slice(
                        child.offset,
                        child.offset + child.size
                    );

                    next.push({
                        bytes: childBytes,
                        registryPath: `${registryPath}/${segmentName}`
                    });
                }
            }
        }

        if (next.length === 0) {
            return [];
        }

        if (segmentIndex !== null) {
            if (segmentIndex >= next.length) {
                return [];
            }
            current = [ next[segmentIndex] ];
        } else {
            current = next;
        }
    }

    return current.map(n => ({
        boxBytes: n.bytes,
        registryPath: n.registryPath
    }));
}

