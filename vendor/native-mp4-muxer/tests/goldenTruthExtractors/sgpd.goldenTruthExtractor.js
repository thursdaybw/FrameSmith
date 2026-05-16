import { readUint32 } from "../../bytes/mp4ByteReader.js";
import {
    readBoxHeaderFromBytes,
    readFourCC    
} from "../../box-schema/boxLayoutReaders.js";
import { getPayloadOffsetForPath } from "../../box-schema/boxSchemas.js";

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("sgpd.readBoxReport: expected Uint8Array");
    }

    // Read header using base box identity (FourCC only)
    const header = readBoxHeaderFromBytes(
        boxBytes,
        "moov/trak/mdia/minf/stbl/sgpd|fixed"
    );

    // We must read groupingType + defaultLength to know layout
    let cursor = getPayloadOffsetForPath(
        "moov/trak/mdia/minf/stbl/sgpd|fixed"
    );

    const groupingType       = readUint32(boxBytes, cursor);
    const groupingTypeString = readFourCC(boxBytes, cursor); cursor += 4;
    const defaultLength      = readUint32(boxBytes, cursor); cursor += 4;
    const entryCount         = readUint32(boxBytes, cursor); cursor += 4;

    // Now we can determine the *actual* schema path
    const schemaPath =
        defaultLength === 0
        ? "moov/trak/mdia/minf/stbl/sgpd|variable"
        : "moov/trak/mdia/minf/stbl/sgpd|fixed";

    const descriptions = [];

    for (let i = 0; i < entryCount; i++) {
        let descriptionLength;

        if (defaultLength === 0) {
            descriptionLength = readUint32(boxBytes, cursor);
            cursor += 4;
        } else {
            descriptionLength = defaultLength;
        }

        const descriptionBytes = Array.from(
            boxBytes.slice(cursor, cursor + descriptionLength)
        );

        if (defaultLength === 0) {
            descriptions.push({
                descriptionLength,
                descriptionBytes: {
                    array: "byte",
                    values: descriptionBytes
                }
            });
        } else {
            descriptions.push({
                descriptionBytes: {
                    array: "byte",
                    values: descriptionBytes
                }
            });
        }

        cursor += descriptionLength;
    }

    return {
        raw: boxBytes,

        box: {
            type: "sgpd",
            header,
            fields: {
                groupingType,
                defaultLength,
                entryCount,
                descriptions
            }
        },

        derived: {
            groupingTypeString
        }
    };
}


// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------
function getEmitterInput(boxBytes) {
    const read = readBoxReport(boxBytes);
    const fields = read.box.fields;

    // Normalize to emitter-supported form
    let defaultLength = fields.defaultLength;
    let descriptions = fields.descriptions.map(
        field => Uint8Array.from(field.descriptionBytes.values)
    );

    if (defaultLength === 0 && descriptions.length > 0) {
        defaultLength = descriptions[0].length;

        descriptions = descriptions.map(desc =>
            desc.slice(0, defaultLength)
        );
    }

    return {
        groupingType: read.derived.groupingTypeString,
        defaultLength,
        descriptions
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerSgpdGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
