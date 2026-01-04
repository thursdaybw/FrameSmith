import {
    extractBoxByPathFromMp4,
    extractSampleEntryFromMp4,
    extractSampleEntry,
    getSampleEntryHeaderSize
} from "../reference/BoxExtractor.js";

import { asIsoBoxContainer } from "../../box-model/Box.js";
import { extractBoxByPathFromBox } from "../reference/BoxExtractor.js";
import { readFourCC } from "../../bytes/mp4ByteReader.js";


import { registerSttsGoldenTruthExtractor } from "./stts.goldenTruthExtractor.js";
import { registerStscGoldenTruthExtractor } from "./stsc.goldenTruthExtractor.js";
import { registerFtypGoldenTruthExtractor } from "./ftyp.goldenTruthExtractor.js";
import { registerTkhdGoldenTruthExtractor } from "./tkhd.goldenTruthExtractor.js";
import { registerMdhdGoldenTruthExtractor } from "./mdhd.goldenTruthExtractor.js";
import { registerMvhdGoldenTruthExtractor } from "./mvhd.goldenTruthExtractor.js";
import { registerAvc1GoldenTruthExtractor } from "./avc1.goldenTruthExtractor.js";
import { registerStsdGoldenTruthExtractor } from "./stsd.goldenTruthExtractor.js";
import { registerStssGoldenTruthExtractor } from "./stss.goldenTruthExtractor.js";
import { registerCttsGoldenTruthExtractor } from "./ctts.goldenTruthExtractor.js";
import { registerStszGoldenTruthExtractor } from "./stsz.goldenTruthExtractor.js";
import { registerStcoGoldenTruthExtractor } from "./stco.goldenTruthExtractor.js";
import { registerDinfGoldenTruthExtractor } from "./dinf.goldenTruthExtractor.js";
import { registerDrefGoldenTruthExtractor } from "./dref.goldenTruthExtractor.js";
import { registerStblGoldenTruthExtractor } from "./stbl.goldenTruthExtractor.js";
import { registerHdlrGoldenTruthExtractor } from "./hdlr.goldenTruthExtractor.js";
import { registerVmhdGoldenTruthExtractor } from "./vmhd.goldenTruthExtractor.js";
import { registerMinfGoldenTruthExtractor } from "./minf.goldenTruthExtractor.js";
import { registerAvcCGoldenTruthExtractor } from "./avcC.goldenTruthExtractor.js";
import { registerBtrtGoldenTruthExtractor } from "./btrt.goldenTruthExtractor.js";
import { registerPaspGoldenTruthExtractor } from "./pasp.goldenTruthExtractor.js";
import { registerMdiaGoldenTruthExtractor } from "./mdia.goldenTruthExtractor.js";
import { registerElstGoldenTruthExtractor } from "./elst.goldenTruthExtractor.js";
import { registerEdtsGoldenTruthExtractor } from "./edts.goldenTruthExtractor.js";
import { registerTrakGoldenTruthExtractor } from "./trak.goldenTruthExtractor.js";
import { registerDataGoldenTruthExtractor } from "./data.goldenTruthExtractor.js";
import { registerIlstGoldenTruthExtractor } from "./ilst.goldenTruthExtractor.js";
import { registerIlstItemGoldenTruthExtractor } from "./ilstItem.goldenTruthExtractor.js";
import { registerMetaHdlrGoldenTruthExtractor } from "./metaHdlr.goldenTruthExtractor.js";
import { registerMetaGoldenTruthExtractor } from "./meta.goldenTruthExtractor.js";
import { registerUdtaGoldenTruthExtractor } from "./udta.goldenTruthExtractor.js";
import { registerMoovGoldenTruthExtractor } from "./moov.goldenTruthExtractor.js";
import { registerFreeGoldenTruthExtractor } from "./free.goldenTruthExtractor.js";
import { registerEsdsGoldenTruthExtractor } from "./esds.goldenTruthExtractor.js";

// -----------------------------------------------------------------------------
// Parser wiring (CHANGE HERE)
// -----------------------------------------------------------------------------

const PARSER_WIRING = [
    ["ftyp",                                    registerFtypGoldenTruthExtractor],
    ["free",                                    registerFreeGoldenTruthExtractor],
    ["moov",                                    registerMoovGoldenTruthExtractor],
    ["moov/mvhd",                               registerMvhdGoldenTruthExtractor],
    ["moov/udta",                               registerUdtaGoldenTruthExtractor],
    ["moov/udta/meta",                          registerMetaGoldenTruthExtractor],
    ["moov/udta/meta/hdlr",                     registerMetaHdlrGoldenTruthExtractor],
    ["moov/udta/meta/ilst",                     registerIlstGoldenTruthExtractor],
    ["moov/udta/meta/ilst/*",                   registerIlstItemGoldenTruthExtractor],
    ["moov/udta/meta/ilst/*/data",              registerDataGoldenTruthExtractor],
    ["moov/trak",                               registerTrakGoldenTruthExtractor],
    ["moov/trak/tkhd",                          registerTkhdGoldenTruthExtractor],
    ["moov/trak/edts",                          registerEdtsGoldenTruthExtractor],
    ["moov/trak/edts/elst",                     registerElstGoldenTruthExtractor],
    ["moov/trak/mdia",                          registerMdiaGoldenTruthExtractor],
    ["moov/trak/mdia/hdlr",                     registerHdlrGoldenTruthExtractor],
    ["moov/trak/mdia/mdhd",                     registerMdhdGoldenTruthExtractor],
    ["moov/trak/mdia/minf",                     registerMinfGoldenTruthExtractor],
    ["moov/trak/mdia/minf/vmhd",                registerVmhdGoldenTruthExtractor],
    ["moov/trak/mdia/minf/dinf",                registerDinfGoldenTruthExtractor],
    ["moov/trak/mdia/minf/dinf/dref",           registerDrefGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl",                registerStblGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stts",           registerSttsGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsc",           registerStscGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd",           registerStsdGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stss",           registerStssGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/ctts",           registerCttsGoldenTruthExtractor], 
    ["moov/trak/mdia/minf/stbl/stsz",           registerStszGoldenTruthExtractor], 
    ["moov/trak/mdia/minf/stbl/stco",           registerStcoGoldenTruthExtractor], 
    ["moov/trak/mdia/minf/stbl/stsd/avc1",      registerAvc1GoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd/avc1/avcC", registerAvcCGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd/avc1/btrt", registerBtrtGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd/avc1/pasp", registerPaspGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd/mp4a/esds", registerEsdsGoldenTruthExtractor], 
];

// -----------------------------------------------------------------------------
// Registry storage
// -----------------------------------------------------------------------------

const REGISTRY = {};

// -----------------------------------------------------------------------------
// Registry API (stable)
// -----------------------------------------------------------------------------

export function registerParser(path, installer) {
    if (REGISTRY[path]) {
        throw new Error(`Parser already registered for ${path}`);
    }

    const impl = {};

    installer({
        readFields(fn) {
            impl.readFields = fn;
        },
        getBuilderInput(fn) {
            impl.getBuilderInput = fn;
        }
    });

    if (!impl.readFields || !impl.getBuilderInput) {
        throw new Error(`Parser for ${path} incomplete`);
    }

    REGISTRY[path] = impl;
}

// Apply wiring
for (const [path, installer] of PARSER_WIRING) {
    registerParser(path, installer);
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------
export const getGoldenTruthBox = {

    fromMp4(mp4Bytes, path, options = {}) {

        if (path.startsWith("moov/trak") && !options.trackType) {
            throw new Error(
                "This path goes through moov/trak, but I don't know which track you want. " +
                "Pass options.trackType as 'video' or 'audio'."
            );
        }

        if (options.sampleEntry && options.trackType) {
            if (options.sampleEntry === "avc1" && options.trackType !== "video") {
                throw new Error(
                    "avc1 is a video sample entry. Use options.trackType 'video'."
                );
            }

            if (options.sampleEntry === "mp4a" && options.trackType !== "audio") {
                throw new Error(
                    "mp4a is an audio sample entry. Use options.trackType 'audio'."
                );
            }
        }

        const parserKey = options.sampleEntry
            ? options.child
            ? `${path}/${options.sampleEntry}/${options.child}`
            : `${path}/${options.sampleEntry}`
            : path;

        const parser = REGISTRY[parserKey];
        if (!parser) {
            throw new Error(`No parser registered for ${parserKey}`);
        }

        let bytes;

        if (
            path.startsWith("moov/trak") &&
            options.trackType === undefined
        ) {
            throw new Error(
               "You passed a path that includes moov/trak. " +
               "You need to specify which track you want using options.trackType. " +
               "Use 'video' or 'audio'."
            );
        }

        // ------------------------------------------------------------
        // 1. Locate base box bytes (trak-aware)
        // ------------------------------------------------------------
        if (path.startsWith("moov/trak") && options.trackType) {

            // 1. Extract *all* trak boxes
            const moov = extractBoxByPathFromMp4(mp4Bytes, "moov");
            if (!moov) {
                throw new Error("moov box not found");
            }

            const moovContainer = asIsoBoxContainer(moov);
            const children = moovContainer.enumerateChildren();

            const trakChildren = children.filter(c => c.type === "trak");

            let matchingTrak = null;

            let wantedHandler;

            if (options.trackType === "video") {
                wantedHandler = "vide";
            } else if (options.trackType === "audio") {
                wantedHandler = "soun";
            } else {
                throw new Error(
                    "trackType must be 'video' or 'audio'"
                );
            }

            for (const child of trakChildren) {
                const trakBytes = moov.slice(
                    child.offset,
                    child.offset + child.size
                );

                const hdlr =
                    extractBoxByPathFromBox(trakBytes, "mdia/hdlr");

                if (!hdlr) {
                    console.log("[esds][trak] hdlr not found");
                    continue;
                }

                const handlerType = readFourCC(hdlr, 16);

                console.log(
                    "[esds][trak] found trak with handler:",
                    handlerType
                );

                if (handlerType === wantedHandler) {
                    console.log(
                        "[esds][trak] SELECTED trak:",
                        handlerType
                    );
                    matchingTrak = trakBytes;
                    break;
                }
            }

            if (!matchingTrak) {
                throw new Error(
                    `No trak found with handler '${options.trackType}'`
                );
            }

            // Strip leading "moov/trak" and continue inside this trak
            const remainingPath =
                path.replace(/^moov\/trak\/?/, "");

            bytes = remainingPath
                ? extractBoxByPathFromBox(matchingTrak, remainingPath)
                : matchingTrak;

            // At this point, bytes === stsd
            // If a SampleEntry is requested, extract it FROM THIS stsd
            if (options.sampleEntry) {
                bytes = extractSampleEntry(
                    bytes,                // stsd bytes scoped to the selected trak
                    options.sampleEntry   // "mp4a"
                );
            }

            const entryCount =
                (bytes[12] << 24) |
                (bytes[13] << 16) |
                (bytes[14] << 8)  |
                bytes[15];

            console.log(
                "[esds][stsd] entryCount:",
                entryCount
            );

            if (!bytes) {
                throw new Error(
                    `Box not found at path '${path}' for track '${options.trackType}'`
                );
            }

        } else if (options.sampleEntry) {

            bytes =  extractSampleEntryFromMp4(
                mp4Bytes,
                path,
                options.sampleEntry
            );

            if (!bytes) {
                throw new Error(
                    `SampleEntry '${options.sampleEntry}' not found at '${path}'`
                );
            }

        } else {

            bytes = extractBoxByPathFromMp4(mp4Bytes, path);

            if (!bytes) {
                throw new Error(`Box not found at path '${path}'`);
            }
        }

        // ------------------------------------------------------------
        // 2. Optional child extraction
        // ------------------------------------------------------------
        if (options.child) {

            let offset = 8;

            if (options.sampleEntry) {
                const headerSize = getSampleEntryHeaderSize(options.sampleEntry);
                offset = 8 + headerSize;
            }

            let found = null;

            console.log(
                "[esds][mp4a] scanning child boxes"
            );

            while (offset + 8 <= bytes.length) {
                const size =
                    (bytes[offset]     << 24) |
                    (bytes[offset + 1] << 16) |
                    (bytes[offset + 2] << 8)  |
                    bytes[offset + 3];

                const type =
                    String.fromCharCode(
                        bytes[offset + 4],
                        bytes[offset + 5],
                        bytes[offset + 6],
                        bytes[offset + 7]
                    );

                console.log(
                    "[esds][mp4a] child:",
                    type,
                    "size:",
                    size
                );

                if (type === options.child) {
                    found = bytes.slice(offset, offset + size);
                    break;
                }

                if (size < 8) break;
                offset += size;
            }

            if (!found) {
                throw new Error(
                    `Child box '${options.child}' not found in '${parserKey}'`
                );
            }

            bytes = found;
        }

        // ------------------------------------------------------------
        // 3. Return parser façade
        // ------------------------------------------------------------
        return {
            readFields() {
                return parser.readFields(bytes);
            },
            getBuilderInput() {
                return parser.getBuilderInput(bytes);
            }
        };
    },


    fromBox(boxBytes, path) {
        const parser = REGISTRY[path];
        if (!parser) {
            throw new Error(`No parser registered for ${path}`);
        }

        return {
            readFields() {
                return parser.readFields(boxBytes);
            },
            getBuilderInput() {
                return parser.getBuilderInput(boxBytes);
            }
        };
    }
};

function normalizeTrackType(trackType) {
    switch (trackType) {
        case "video": return "vide";
        case "audio": return "soun";
        default:
            throw new Error(
                `Unknown track type '${trackType}'. ` +
                "Use 'video' or 'audio'."
            );
    }
}
