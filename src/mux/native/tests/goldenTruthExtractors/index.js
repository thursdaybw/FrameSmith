import {
    extractBoxByPathFromMp4,
    extractSampleEntryFromMp4
} from "../reference/BoxExtractor.js";

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

// -----------------------------------------------------------------------------
// Parser wiring (CHANGE HERE)
// -----------------------------------------------------------------------------

const PARSER_WIRING = [
    ["ftyp",                                    registerFtypGoldenTruthExtractor],
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

        // ------------------------------------------------------------
        // 1. Locate base box bytes
        // ------------------------------------------------------------
        if (options.sampleEntry) {
            bytes = extractSampleEntryFromMp4(
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
            let offset = 8; // child boxes start after header

            // VisualSampleEntry has a fixed 78-byte preamble
            if (options.sampleEntry) {
                offset = 8 + 78;
            }

            let found = null;

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
