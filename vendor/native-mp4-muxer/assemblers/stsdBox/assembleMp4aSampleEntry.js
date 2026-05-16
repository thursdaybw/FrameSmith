import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

/**
 * assembleMp4aSampleEntry
 * =======================
 *
 * Assembler for mp4a SampleEntry.
 *
 * Responsibilities:
 * - Accept builder intent from getEmitterInput()
 * - Build child boxes via EmitterRegistry
 * - Pass fully-built children into the mp4a emitter
 *
 * Emitters do NOT call other emitters.
 * Hierarchy is constructed here.
 */

export function assembleMp4aSampleEntry(intent, { emitContainer }) {
    // ---------------------------------------------------------
    // Shape validation
    // ---------------------------------------------------------
    if (typeof intent !== "object" || intent === null) {
        throw new Error("assembleMp4aSampleEntry: intent must be an object");
    }

    const allowedKeys = ["channelCount", "sampleSize", "sampleRate", "esds", "btrt"];
    const actualKeys = Object.keys(intent);

    for (const key of actualKeys) {
        if (!allowedKeys.includes(key)) {
            throw new Error(
                `assembleMp4aSampleEntry: unexpected field '${key}'. ` +
                `Allowed fields: ${allowedKeys.join(", ")}`
            );
        }
    }

    const {
        channelCount,
        sampleSize,
        sampleRate,
        esds,
        btrt
    } = intent;

    // ---------------------------------------------------------
    // Required scalar fields
    // ---------------------------------------------------------
    if (!Number.isInteger(channelCount) || channelCount < 0) {
        throw new Error(
            `assembleMp4aSampleEntry: channelCount must be a non-negative integer, ` +
            `got ${typeof channelCount}`
        );
    }

    if (!Number.isInteger(sampleSize) || sampleSize < 0) {
        throw new Error(
            `assembleMp4aSampleEntry: sampleSize must be a non-negative integer, ` +
            `got ${typeof sampleSize}`
        );
    }

    if (!Number.isInteger(sampleRate) || sampleRate < 0) {
        throw new Error(
            `assembleMp4aSampleEntry: sampleRate must be a non-negative integer, ` +
            `got ${typeof sampleRate}`
        );
    }

    // ---------------------------------------------------------
    // Required child: esds
    // ---------------------------------------------------------
    if (!(esds instanceof Uint8Array)) {
        throw new Error(
            `assembleMp4aSampleEntry: esds must be a Uint8Array, ` +
            `got ${esds === null ? "null" : typeof esds}`
        );
    }

    // ---------------------------------------------------------
    // esds payload integrity gate (NO box headers allowed)
    // ---------------------------------------------------------
    if (esds.length >= 8 && readFourCC(esds, 4) === "esds") {
        throw new Error(
            "assembleMp4aSampleEntry: invalid esds payload.\n" +
            "Expected opaque ES descriptor bytes, but received full 'esds' box bytes.\n" +
            "This indicates a contract violation in mp4a.getEmitterInput():\n" +
            "pass derived.esds (payload) instead of children.esds.raw (box)."
        );
    }

    // ---------------------------------------------------------
    // Optional child: btrt
    // ---------------------------------------------------------
    if (btrt !== undefined) {
        if (typeof btrt !== "object" || btrt === null) {
            throw new Error(
                `assembleMp4aSampleEntry: btrt must be an object when provided, ` +
                `got ${typeof btrt}`
            );
        }

        const requiredBtrtFields = ["bufferSizeDB", "maxBitrate", "avgBitrate"];

        for (const name of requiredBtrtFields) {
            if (!Number.isInteger(btrt[name]) || btrt[name] < 0) {
                throw new Error(
                    `assembleMp4aSampleEntry: btrt.${name} must be a non-negative integer, ` +
                    `got ${btrt[name] === undefined ? "undefined" : typeof btrt[name]}`
                );
            }
        }
    }

    // ---------------------------------------------------------
    // Build required child: esds
    // ---------------------------------------------------------
    const esdsNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|mp4a/esds",
            { esds }
        );

    // ---------------------------------------------------------
    // Build optional child: btrt
    // ---------------------------------------------------------
    let btrtNode = null;

    if (btrt !== undefined) {
        btrtNode =
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stsd|mp4a/btrt",
                btrt
            );
    }

    // ---------------------------------------------------------
    // Emit mp4a SampleEntry
    // ---------------------------------------------------------
    return emitContainer(
        "moov/trak/mdia/minf/stbl/stsd|mp4a",
        {
            channelCount,
            sampleSize,
            sampleRate,
            esdsNode,
            ...(btrtNode ? { btrtNode } : {})
        }
    );

}

export function registerMp4aSampleEntryAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/mdia/minf/stbl/stsd|mp4a",
        assembleMp4aSampleEntry
    );
}
