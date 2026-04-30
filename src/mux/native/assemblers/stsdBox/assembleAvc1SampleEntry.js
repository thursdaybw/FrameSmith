import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

/**
 * assembleAvc1SampleEntry
 * =======================
 *
 * Assembler for avc1 SampleEntry (H.264).
 *
 * IMPORTANT:
 * ----------
 * avc1 is NOT a normal ISO BMFF container box.
 * It is a SampleEntry, which has a codec-defined fixed header
 * followed by child boxes.
 *
 * This assembler exists to:
 * - enforce structural and policy correctness
 * - prevent direct emitter invocation
 * - construct the avc1 hierarchy explicitly
 *
 * Emitters do NOT call other emitters.
 * Hierarchy is constructed here.
 */

export function assembleAvc1SampleEntry(intent, { emitContainer }) {

    // ---------------------------------------------------------
    // Shape validation
    // ---------------------------------------------------------
    if (typeof intent !== "object" || intent === null) {
        throw new Error("assembleAvc1SampleEntry: intent must be an object");
    }

    const allowedKeys = [
        "width",
        "height",
        "avcC",
        "compressorName",
        "pasp",
        "btrt"
    ];

    const actualKeys = Object.keys(intent);

    for (const key of actualKeys) {
        if (!allowedKeys.includes(key)) {
            throw new Error(
                `assembleAvc1SampleEntry: unexpected field '${key}'. ` +
                `Allowed fields: ${allowedKeys.join(", ")}`
            );
        }
    }

    const {
        width,
        height,
        avcC,
        compressorName = "",
        pasp,
        btrt
    } = intent;

    // ---------------------------------------------------------
    // Required scalar fields
    // ---------------------------------------------------------
    if (!Number.isInteger(width) || width <= 0) {
        throw new Error(
            `assembleAvc1SampleEntry: width must be a positive integer, ` +
            `got ${typeof width}`
        );
    }

    if (!Number.isInteger(height) || height <= 0) {
        throw new Error(
            `assembleAvc1SampleEntry: height must be a positive integer, ` +
            `got ${typeof height}`
        );
    }

    // ---------------------------------------------------------
    // Required child: avcC (opaque payload only)
    // ---------------------------------------------------------
    if (!(avcC instanceof Uint8Array) || avcC.length === 0) {
        throw new Error(
            "assembleAvc1SampleEntry: avcC must be a non-empty Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // avcC payload integrity gate (NO box headers allowed)
    // ---------------------------------------------------------
    if (avcC.length >= 8 && readFourCC(avcC, 4) === "avcC") {
        throw new Error(
            "assembleAvc1SampleEntry: invalid avcC payload.\n" +
            "Expected opaque AVCDecoderConfigurationRecord bytes, but received full 'avcC' box bytes.\n" +
            "Pass derived.avcC (payload), not children.avcC.raw (box)."
        );
    }

    // ---------------------------------------------------------
    // Optional child: pasp
    // ---------------------------------------------------------
    // NOTE:
    // Most real-world avc1 sample entries include pasp.
    // It is optional here to allow future policy control,
    // but reference files may omit it.
    let paspNode = null;

    if (pasp !== undefined) {
        if (
            typeof pasp !== "object" ||
            !Number.isInteger(pasp.hSpacing) ||
            !Number.isInteger(pasp.vSpacing)
        ) {
            throw new Error(
                "assembleAvc1SampleEntry: pasp must contain integer hSpacing and vSpacing"
            );
        }

        paspNode =
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stsd|avc1/pasp",
                pasp
            );
    }

    // ---------------------------------------------------------
    // Optional child: btrt
    // ---------------------------------------------------------
    let btrtNode = null;

    if (btrt !== undefined) {
        if (
            typeof btrt !== "object" ||
            !Number.isInteger(btrt.bufferSizeDB) ||
            !Number.isInteger(btrt.maxBitrate) ||
            !Number.isInteger(btrt.avgBitrate)
        ) {
            throw new Error(
                "assembleAvc1SampleEntry: btrt must contain integer bufferSizeDB, maxBitrate, avgBitrate"
            );
        }

        btrtNode =
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stsd|avc1/btrt",
                btrt
            );
    }

    // ---------------------------------------------------------
    // Build required child: avcC
    // ---------------------------------------------------------
    const avcCNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|avc1/avcC",
            { avcC }
        );

    const compressorNameFields = buildCompressorNameFields(compressorName);

    // ---------------------------------------------------------
    // Emit avc1 SampleEntry
    // ---------------------------------------------------------
    return emitContainer(
        "moov/trak/mdia/minf/stbl/stsd|avc1",
        {
            width,
            height,
            avcCNode,
            compressorNameFields,
            ...(paspNode ? { paspNode } : {}),
            ...(btrtNode ? { btrtNode } : {})
        }
    );
}

// ---------------------------------------------------------------------------
// Compressor name construction (explicit, readable)
// ---------------------------------------------------------------------------

function buildCompressorNameFields(compressorName) {
    const encoder = new TextEncoder();
    const nameBytes = encoder.encode(compressorName);
    const nameLength = Math.min(nameBytes.length, 31);

    const padded = [
        ...Array.from(nameBytes.slice(0, nameLength)),
        ...Array(31 - nameLength).fill(0)
    ];

    return [
        // compressorNameLength
        { byte: nameLength },

        // compressorNameBytes (FULL 31 bytes, including padding)
        {
            array: "byte",
            values: padded
        }
    ];
}
// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerAvc1SampleEntryAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/mdia/minf/stbl/stsd|avc1",
        assembleAvc1SampleEntry
    );
}
