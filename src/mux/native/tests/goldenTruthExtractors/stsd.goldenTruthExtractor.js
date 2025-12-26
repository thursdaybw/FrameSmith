import { readUint32, readFourCC } from "../../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./index.js";

function readStsdBoxFieldsFromBoxBytes(box) {
    const entryCount = readUint32(box, 12);

    return {
        entryCount,
        raw: box
    };
}

function getStsdBuildParamsFromBoxBytes(box) {
    const entryCount = readUint32(box, 12);

    if (entryCount !== 1) {
        throw new Error(
            `STSD: expected single sample entry, got ${entryCount}`
        );
    }

    // First sample entry starts at byte 16
    const sampleEntryType = readFourCC(box, 16 + 4);

    if (sampleEntryType !== "avc1") {
        throw new Error(
            `STSD: unsupported sample entry '${sampleEntryType}'`
        );
    }

    // Delegate sample entry parsing
    const avc1 = getGoldenTruthBox.fromBox(
        box.slice(16),
        "moov/trak/mdia/minf/stbl/stsd/avc1"
    );

    const avc1Params = avc1.getBuilderInput();

    return {
        codec: "avc1",
        ...avc1Params
    };
}

export function registerStsdGoldenTruthExtractor(register) {
    register.readFields(readStsdBoxFieldsFromBoxBytes);
    register.getBuilderInput(getStsdBuildParamsFromBoxBytes);
}
