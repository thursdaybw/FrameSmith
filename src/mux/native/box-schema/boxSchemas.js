import { HEADER_LAYOUTS } from "./headerLayouts.js";

/**
 * Canonical MP4 Box Schema Registry
 * =================================
 *
 * This schema is a STRICT, LOSSLESS description of the MP4 ISO boxes
 * supported by this system.
 *
 * It is NOT:
 *   - a semantic model
 *   - a convenience abstraction
 *   - a partial view of the box
 *   - a consumer-oriented API
 *
 * It IS:
 *   - an exact reflection of what exists on disk, in bytes
 *   - a declarative mirror of the MP4 ISO specifications we support
 *   - the single source of truth for structural extraction
 *
 * ---------------------------------------------------------------------
 * Identity
 * ---------------------------------------------------------------------
 *
 * Schemas are keyed by *extractor registry path*.
 *
 * A box is identified by:
 *   - its exact location in the MP4 box tree
 *
 * FourCC alone is NOT an identity.
 * Path is the identity.
 *
 * ---------------------------------------------------------------------
 * Structural completeness (non-negotiable)
 * ---------------------------------------------------------------------
 *
 * Every field that exists in the MP4 box payload MUST be represented
 * in this schema.
 *
 * This includes:
 *   - count fields (e.g. entry_count, sample_count)
 *   - layout fields required by the ISO specification
 *   - ordering as it appears on disk
 *
 * No on-disk field may be omitted.
 * No field may be implied.
 * No field may be derived.
 *
 * If a field exists in the bytes, it belongs in the schema.
 *
 * ---------------------------------------------------------------------
 * What the schema defines
 * ---------------------------------------------------------------------
 *
 * For each box path, the schema defines:
 *
 *   - header layout
 *       - Basic or Full (version + flags)
 *
 *   - structural role
 *       - container or terminal
 *
 *   - fields
 *       - a complete, ordered description of the box payload
 *       - fields appear in on-disk order
 *       - field shapes correspond directly to byte layout
 *
 *   - allowed children
 *       - for container boxes only
 *       - representing immediate MP4 box containment
 *
 * Nothing more.
 * Nothing less.
*
* ---------------------------------------------------------------------
* Architectural contract
* ---------------------------------------------------------------------
*
* This schema is authoritative.
*
* - Extractors MUST report exactly what the schema declares.
* - Emitters MUST serialize exactly what the schema declares.
* - Normalizers MUST NOT invent, infer, or compensate for missing fields.
* - Tests MUST fail if extractor output diverges from schema.
*
* Derived data, semantic interpretation, normalization, and convenience
* access MUST live outside the schema, typically under:
*
*   readBoxReport().derived
*
* ---------------------------------------------------------------------
* Rationale
* ---------------------------------------------------------------------
*
* This system is a demuxer engine, not a consumer-facing demuxer.
*
* Structural truth is preserved at all costs.
* Abstraction is layered on top, never baked in.
*
* ---------------------------------------------------------------------
* Payload obligation rules (terminal boxes)
* ---------------------------------------------------------------------
*
* For terminal boxes, payload obligation is derived by default and may be
* explicitly overridden.
*
* Default rules:
*
*   - If a terminal box declares one or more fields:
*       → payload is REQUIRED
*
*   - If a terminal box declares no fields:
*       → payload is FORBIDDEN
*
* These defaults reflect the structural intent of the schema:
* fields represent semantic payload that must exist if declared.
*
* ---------------------------------------------------------------------
* payloadRequirement override
* ---------------------------------------------------------------------
*
* A terminal box schema may explicitly override the default behavior using:
*
*   payloadRequirement: "required" | "optional" | "forbidden"
*
* This is only necessary when the default rule is not correct.
*
* Example use case:
*   - A terminal box has defined fields
*   - The payload structure is known
*   - But the payload itself is legally optional
*
* In such cases, declaring:
*
*   payloadRequirement: "optional"
*
* means:
*   - If payload is present, it MUST match the declared fields
*   - If payload is absent, the box is still structurally valid
*
* ---------------------------------------------------------------------
* Notes
* ---------------------------------------------------------------------
*
* - payloadRequirement is a structural constraint, not a semantic one
* - It controls whether payload may exist, not how it is interpreted
* - Most terminal boxes rely on the default behavior and do not declare it
* - Boxes like 'free' and 'skip' do not require this override, as they
*   declare no fields and therefore forbid payload by default
*
| Schema type | Size (bytes) | DSL token | Notes                               |
| ----------- | ------------ | --------- | ----------------------------------- |
| `uint8`     | 1            | `byte`    | ✅ direct                            |
| `int8`      | 1            | `byte`    | signedness irrelevant at byte level |
| `uint16`    | 2            | `short`   | big-endian                          |
| `int16`     | 2            | `short`   | big-endian                          |
| `uint32`    | 4            | `int`     | big-endian                          |
| `int32`     | 4            | `int`     | big-endian                          |
| `fourcc`    | 4            | `type`    | literal `{ type: "abcd" }`          |
| ----------- | ------------ | --------------------------------------------------------------- |
| `uint8[]`   | 1            | `{ array: "byte", values }`                                     |
| `uint16[]`  | 2            | `{ array: "short", values }`                                    |
| `uint32[]`  | 4            | `{ array: "int", values }`                                      |
| `opaque[]`  | 1 (bytes)    | `{ array: "byte", values }` (container-opaque, not interpreted) |
*/
export const BOX_SCHEMAS = {

    // ---------------------------------------------------------------------
    // Root box - The MP4 File itself 
    // ---------------------------------------------------------------------
    "$mp4": {
        headerLayout: "Basic",
        structuralRole: "container",
        children: ["ftyp", "moov", "mdat", "free", "skip"]
    },

    "free": {
        headerLayout: "Basic",
        structuralRole: "terminal",
    },

    "mdat": {
        headerLayout: "Basic",
        structuralRole: "terminal",
        payloadRequirement: "required",
        opaque: true
    },

    // ---------------------------------------------------------------------
    // Top-level containers
    // ---------------------------------------------------------------------

    "moov": {
        headerLayout: "Basic",
        structuralRole: "container",
        children: ["trak"]
    },

    "ftyp": {
        headerLayout: "Basic",
        structuralRole: "terminal",
        fields: {
            majorBrand: "fourcc",
            minorVersion: "uint32",

            // compatible_brands (flat, repeated)
            compatibleBrand0: "fourcc",
            compatibleBrand1: "fourcc",
            compatibleBrand2: "fourcc",
            compatibleBrand3: "fourcc"
        }
    },

    "moov/mvhd": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            creationTime: "uint32",
            modificationTime: "uint32",
            timescale: "uint32",
            duration: "uint32",
            rate: "int32",
            volume: "int16",
            reservedShort: "uint16",

            reserved0: "uint32",
            reserved1: "uint32",

            matrix0: "int32",
            matrix1: "int32",
            matrix2: "int32",
            matrix3: "int32",
            matrix4: "int32",
            matrix5: "int32",
            matrix6: "int32",
            matrix7: "int32",
            matrix8: "int32",

            preDefined0: "uint32",
            preDefined1: "uint32",
            preDefined2: "uint32",
            preDefined3: "uint32",
            preDefined4: "uint32",
            preDefined5: "uint32",

            nextTrackId: "uint32"
        }
    },

    "moov/udta": {
        headerLayout: "Basic",
        structuralRole: "container",
        children: ["meta"]
    },

    "moov/udta/meta": {
        headerLayout: "Full",
        structuralRole: "container",
        children: ["hdlr", "ilst"]
    },

    "moov/udta/meta/hdlr": {
        headerLayout: "Full",
        structuralRole: "terminal",

        fields: {
            zeroPadding: "uint32",
            handlerType: "fourcc",
            nameBytes:   "uint8[]"
        }
    },

    "moov/udta/meta/ilst": {
        headerLayout: "Basic",
        structuralRole: "container",
        children: ["{atom}"]
    },

    "moov/udta/meta/ilst/{atom}": {
        headerLayout: "Basic",
        structuralRole: "container",
        dynamicFourCC: true,
        fields: {},
        children: ["data"]
    },

    "moov/udta/meta/ilst/{atom}/data": {
        headerLayout: "Full",
        structuralRole: "terminal",
        dynamicFourCC: true,

        fields: {
            dataType: "uint32",
            locale:   "uint32",
            value:    "opaque"
        },
    },

    "moov/trak": {
        headerLayout: "Basic",
        structuralRole: "container",
        "children": [
            "tkhd",
            "mdia",
            "edts?"
        ]
    },

    "moov/trak/edts": {
        headerLayout: "Basic",
        structuralRole: "container",
        children: [
            "elst"
        ]
    },

    "moov/trak/edts/elst": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            entryCount: "uint32",
            entries: [{
                editDuration: "scalar",
                mediaTime: "scalar",
                mediaRateInteger: "scalar",
                mediaRateFraction: "scalar"
            }]
        }
    },

    "moov/trak/tkhd": {
        headerLayout: "Full",
        structuralRole: "terminal",

        fields: {
            creationTime:     "uint32",
            modificationTime: "uint32",
            trackId:          "uint32",
            reserved0:        "uint32",
            duration:         "uint32",
            reserved1:        "uint32",
            reserved2:        "uint32",

            layer:            "int16",
            alternateGroup:   "int16",
            volume:           "int16",
            reserved3:        "uint16",

            // matrix (3x3, scalar-expanded)
            matrix_a: "int32",
            matrix_b: "int32",
            matrix_u: "int32",
            matrix_c: "int32",
            matrix_d: "int32",
            matrix_v: "int32",
            matrix_x: "int32",
            matrix_y: "int32",
            matrix_w: "int32",

            width:  "uint32",
            height: "uint32"
        }
    },

    "moov/trak/mdia": {
        headerLayout: "Basic",
        structuralRole: "container",

        children: [
            "mdhd",
            "hdlr",
            "minf"
        ]
    },

    "moov/trak/mdia/hdlr": {
        headerLayout: "Full",
        structuralRole: "terminal",

        fields: {
            preDefined:  "uint32",
            handlerType: "fourcc",
            reserved1:   "uint32",
            reserved2:   "uint32",
            reserved3:   "uint32",
            nameBytes:   "uint8[]"
        }
    },

    "moov/trak/mdia/mdhd": {
        headerLayout: "Full",
        structuralRole: "terminal",

        fields: {
            creationTime:     "uint32",
            modificationTime: "uint32",
            timescale:        "uint32",
            duration:         "uint32",
            language:         "uint16",
            predefined:       "uint16"
        }
    },

    "moov/trak/mdia/minf": {
        headerLayout: "Basic",
        structuralRole: "container",
        children: ["vmhd?", "smhd?", "dinf", "stbl"]
    },

    "moov/trak/mdia/minf/vmhd": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            graphicsmode: "uint16",
            opcolorR:     "uint16",
            opcolorG:     "uint16",
            opcolorB:     "uint16"
        },
    },

    "moov/trak/mdia/minf/smhd": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            balance:  "int16",
            reserved: "uint16"
        },
    },

    // ---------------------------------------------------------------------
    // DINF — Data Information Box
    // ---------------------------------------------------------------------

    "moov/trak/mdia/minf/dinf": {
        headerLayout: "Basic",
        structuralRole: "container",
        children: ["dref"]
    },

    /**
     * DREF — Data Reference Box
     *
     * Layout:
     *   uint32 entry_count
     *   url[entry_count]
     *
     * Framesmith invariant:
     * - entry_count is always 1
     * - exactly one self-contained `url ` entry
     */
    "moov/trak/mdia/minf/dinf/dref": {
        headerLayout: "Full",
        structuralRole: "container",
        fields: {
            entryCount: "uint32"
        },
        children: ["url "]
    },

    /**
     * URL  — Data Entry URL Box
     *
     * Self-contained media reference.
     *
     * Layout:
     * - version = 0
     * - flags   = 1
     * - no payload
     */
    "moov/trak/mdia/minf/dinf/dref/url ": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {}
    },

    "moov/trak/mdia/minf/stbl": {
        headerLayout: "Basic",
        structuralRole: "container",
        fields: {},
        children: [
            "stsd",
            "stts",
            "stsc",
            "stsz",
            // Chunk offset table: exactly one required
            {
                oneOf: ["stco", "co64"],
                required: true,
                role: "chunkOffsets"
            },
            "stss?",
            "ctts?",
            "sbgp?",
            "sgpd?",
        ]
    },

    // ---------------------------------------------------------------------
    // STSD + SampleEntry space
    // ---------------------------------------------------------------------

    /**
     * STSD — Sample Description Box
     *
     * Layout:
     *   uint32 entry_count
     *   sample_entry[entry_count]
     *
     * Note:
     * - Sample entries are child boxes, not fields
     */
    "moov/trak/mdia/minf/stbl/stsd": {
        headerLayout: "Full",
        structuralRole: "container",
        containerModel: "table",
        table: {
            entryType: "SampleEntry",
            countField: "sampleEntryCount"
        },
        fields: {
            sampleEntryCount: "uint32"
        }
    },

    "moov/trak/mdia/minf/stbl/stsd|mp4a": {
        headerLayout: "Basic",
        structuralRole: "container",

        sampleEntry: {
            fixedFieldsSize: 28,
            childrenOffset: 36 // 8 (box header) + 28 (fixed fields)
        },

        fields: {
            // reserved[6]
            reserved1: "uint8",
            reserved2: "uint8",
            reserved3: "uint8",
            reserved4: "uint8",
            reserved5: "uint8",
            reserved6: "uint8",

            // data_reference_index
            dataReferenceIndex: "uint16",

            // reserved / pre_defined
            reserved7: "uint32",
            reserved8: "uint32",

            // AudioSampleEntry fields
            channelCount: "uint16",
            sampleSize:   "uint16",
            preDefined1:  "uint16",
            preDefined2:  "uint16",

            // sampleRate (16.16 fixed-point)
            sampleRate: "uint32"
        },

        children: ["esds?", "dOps?", "btrt?"]
    },

    "moov/trak/mdia/minf/stbl/stsd|mp4a/btrt": {
        headerLayout: "Basic",
        structuralRole: "terminal",
        fields: {
            bufferSizeDB: "uint32",
            maxBitrate:   "uint32",
            avgBitrate:   "uint32"
        }
    },

    "moov/trak/mdia/minf/stbl/stsd|Opus/btrt": {
        headerLayout: "Basic",
        structuralRole: "terminal",
        fields: {
            bufferSizeDB: "uint32",
            maxBitrate:   "uint32",
            avgBitrate:   "uint32"
        }
    },

    "moov/trak/mdia/minf/stbl/stsd|Opus": {
        headerLayout: "Basic",
        structuralRole: "container",

        // Opus AudioSampleEntry uses the same fixed field layout as mp4a
        sampleEntryFixedFieldsSize: 8,

        sampleEntry: {
            fixedFieldsSize: 28,
            childrenOffset: 36   // 8 (box header) + 28 (fixed fields)
        },
        /*

| Field                | Size | Offset (from box body start) |
| -------------------- | ---- | ---------------------------- |
| reserved[6]          | 6    | 0                            |
| data_reference_index | 2    | 6                            |
| reserved[8]          | 8    | 8                            |
| channelcount         | 2    | 16                           |
| samplesize           | 2    | 18                           |
| pre_defined          | 2    | 20                           |
| reserved             | 2    | 22                           |
| samplerate           | 4    | 24                           |
*/
        fieldsoff: {
            reserved1:  "uint8",
            f1:  "uint8",
            f2:  "uint8",
            f3:  "uint8",
            f4:  "uint8",
            f5:  "uint8",
            f6:  "uint8",
            f7:  "uint8",
            f8:  "uint8",
            f9:  "uint8",
            f10: "uint8",
            f11: "uint8",
            f12: "uint8",
            f13: "uint8",
            f14: "uint8",
            f15: "uint8",
            f16: "uint8",
            f17: "uint8",
            f18: "uint8",
            f19: "uint8",
            f20: "uint8",
            f21: "uint8",
            f22: "uint8",
            f23: "uint8",
            f24: "uint8",
            f25: "uint8",
            f26: "uint8",
            f27: "uint8",
        },

        fieldsOrigin: {
            f0:  "uint8",
            f1:  "uint8",
            f2:  "uint8",
            f3:  "uint8",
            f4:  "uint8",
            f5:  "uint8",
            f6:  "uint8",
            f7:  "uint8",
            f8:  "uint8",
            f9:  "uint8",
            f10: "uint8",
            f11: "uint8",
            f12: "uint8",
            f13: "uint8",
            f14: "uint8",
            f15: "uint8",
            f16: "uint8",
            f17: "uint8",
            f18: "uint8",
            f19: "uint8",
            f20: "uint8",
            f21: "uint8",
            f22: "uint8",
            f23: "uint8",
            f24: "uint8",
            f25: "uint8",
            f26: "uint8",
            f27: "uint8",
        },

        /*
| Schema type | Size (bytes) | DSL token | Notes                               |
| ----------- | ------------ | --------- | ----------------------------------- |
| `uint8`     | 1            | `byte`    | ✅ direct                            |
| `int8`      | 1            | `byte`    | signedness irrelevant at byte level |
| `uint16`    | 2            | `short`   | big-endian                          |
| `int16`     | 2            | `short`   | big-endian                          |
| `uint32`    | 4            | `int`     | big-endian                          |
| `int32`     | 4            | `int`     | big-endian                          |
| `fourcc`    | 4            | `type`    | literal `{ type: "abcd" }`          |
*/

        fieldsold: {
            // reserved[6]
            reserved1: "uint8",
            reserved2: "uint8",
            reserved3: "uint8",
            reserved4: "uint8",
            reserved5: "uint8",
            reserved6: "uint8",
            dataReferenceIndex: "uint16",
            f8:  "uint8",
            f9:  "uint8",
            f10: "uint8",
            f11: "uint8",
            f12: "uint8",
            f13: "uint8",
            f14: "uint8",
            f15: "uint8",
            f16: "uint8",
            f17: "uint8",
            f18: "uint8",
            f19: "uint8",
            f20: "uint8",
            f21: "uint8",
            f22: "uint8",
            f23: "uint8",
            f24: "uint8",
            f25: "uint8",
            f26: "uint8",
            f27: "uint8",
        },
        fields: {
            // SampleEntry
            reserved1: "uint8",
            reserved2: "uint8",
            reserved3: "uint8",
            reserved4: "uint8",
            reserved5: "uint8",
            reserved6: "uint8",

            dataReferenceIndex: "uint16",

            // AudioSampleEntry reserved / pre_defined
            reserved7: "uint32",
            reserved8: "uint32",

            // AudioSampleEntry fields
            channelCount: "uint16",
            sampleSize:   "uint16",
            preDefined1:  "uint16",
            preDefined2:  "uint16",

            // sampleRate (16.16)
            sampleRate: "uint32"
        },

        fieldsoff: {
            reserved1: "uint8", // byte
            reserved2: "uint8", // byte
            reserved3: "uint8", // byte
            reserved4: "uint8", // byte
            reserved5: "uint8", // byte
            reserved6: "uint8", // byte

            // data_reference_index
            dataReferenceIndex: "uint16", // short 

            // reserved / pre_defined
            reserved7: "uint32", // int
            reserved8: "uint32", // int

            // AudioSampleEntry fields
            channelCount: "uint16", // short 
            sampleSize:   "uint16", // short 
            preDefined1:  "uint16", // short 
            preDefined2:  "uint16", // short 

            // sampleRate (16.16 fixed-point)
            sampleRate: "uint32" // int
        },



        children: ["dOps?", "btrt?"]
    },

    "moov/trak/mdia/minf/stbl/stsd|avc1": {
        headerLayout: "Basic",
        structuralRole: "container",

        sampleEntry: {
            fixedFieldsSize: 78,
            childrenOffset: 86 // 8 (box header) + 78 (fixed fields)
        },

        children: [
            "avcC",
            "btrt",
            "pasp"
        ],
        fields: {
            reserved0: "uint8",
            reserved1: "uint8",
            reserved2: "uint8",
            reserved3: "uint8",
            reserved4: "uint8",
            reserved5: "uint8",

            dataReferenceIndex: "uint16",

            preDefined1: "uint16",
            reserved6:   "uint16",

            preDefined2: "uint32",
            preDefined3: "uint32",
            preDefined4: "uint32",

            width:  "uint16",
            height: "uint16",

            horizResolution: "uint32",
            vertResolution:  "uint32",

            reserved7: "uint32",

            frameCount: "uint16",

            compressorNameLength: "uint8",
            compressorNameBytes:  "uint8[]",

            depth: "uint16",
            preDefined5: "uint16"
        }
    },

    // ---------------------------------------------------------------------
    // Opaque codec boxes
    // ---------------------------------------------------------------------

    "moov/trak/mdia/minf/stbl/stsd|avc1/avcC": {
        headerLayout: "Basic",
        structuralRole: "terminal",
        opaque: true,
        fields: {
            opaquePayloadBytes: "uint8[]"
        }
    },

    "moov/trak/mdia/minf/stbl/stsd|avc1/btrt": {
        headerLayout: "Basic",
        structuralRole: "terminal",
        fields: {
            bufferSizeDB: "uint32",
            maxBitrate:   "uint32",
            avgBitrate:   "uint32"
        }
    },

    "moov/trak/mdia/minf/stbl/stsd|avc1/pasp": {
        headerLayout: "Basic",
        structuralRole: "terminal",
        fields: {
            hSpacing: "uint32",
            vSpacing: "uint32",
        }
    },

    "moov/trak/mdia/minf/stbl/stsd|hvc1": {
        headerLayout: "Basic",
        structuralRole: "container",

        sampleEntry: {
            fixedFieldsSize: 78,
            childrenOffset: 86 // 8 (box header) + 78 (fixed fields)
        },

        children: [
            "hvcC",
            "btrt",
            "pasp"
        ],

        fields: {
            reserved0: "uint8",
            reserved1: "uint8",
            reserved2: "uint8",
            reserved3: "uint8",
            reserved4: "uint8",
            reserved5: "uint8",

            dataReferenceIndex: "uint16",

            preDefined1: "uint16",
            reserved6:   "uint16",

            preDefined2: "uint32",
            preDefined3: "uint32",
            preDefined4: "uint32",

            width:  "uint16",
            height: "uint16",

            horizResolution: "uint32",
            vertResolution:  "uint32",

            reserved7: "uint32",

            frameCount: "uint16",

            compressorNameLength: "uint8",
            compressorNameBytes:  "uint8[]",

            depth: "uint16",
            preDefined5: "uint16"
        }
    },

    "moov/trak/mdia/minf/stbl/stsd|hvc1/hvcC": {
        headerLayout: "Basic",
        structuralRole: "terminal",
        opaque: true,
        fields: {
            opaquePayloadBytes: "uint8[]"
        }
    },

    "moov/trak/mdia/minf/stbl/stsd|mp4a/esds": {
        headerLayout: "Full",
        structuralRole: "terminal",
        opaque: true,
        fields: {
            opaquePayloadBytes: "uint8[]"
        }
    },

    "moov/trak/mdia/minf/stbl/stsd|Opus/dOps": {
        headerLayout: "Full",
        structuralRole: "terminal",
        opaque: true,
        fields: {
            opaquePayloadBytes: "uint8[]"
        }
    },

    // ---------------------------------------------------------------------
    // STBL terminal boxes (counted tables)
    // ---------------------------------------------------------------------

    /**
     * STTS — Time To Sample
     *
     * Layout:
     *   uint32 entry_count
     *   { sampleCount, sampleDelta }[entry_count]
     */
    "moov/trak/mdia/minf/stbl/stts": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            entryCount: "uint32",
            entries: [{
                sampleCount: "uint32",
                sampleDelta: "uint32"
            }]
        }
    },

    /**
     * STSC — Sample To Chunk
     *
     * Layout:
     *   uint32 entry_count
     *   { firstChunk, samplesPerChunk, sampleDescriptionIndex }[entry_count]
     */
    "moov/trak/mdia/minf/stbl/stsc": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            entryCount: "uint32",
            entries: [{
                firstChunk:             "uint32",
                samplesPerChunk:        "uint32",
                sampleDescriptionIndex: "uint32"
            }]
        }
    },

    /**
     * STSZ — Sample Size Box (extractor envelope)
     *
     * This schema exists ONLY for extractor validation.
     * Actual layout is selected via |fixed or |variable variants.
     */
    "moov/trak/mdia/minf/stbl/stsz": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            sampleSize:  "uint32",
            sampleCount: "uint32",
            sizes:       "opaque" // union envelope
        }
    },

    // ---------------------------------------------------------
    // STSZ — variable-size form (sampleSize == 0)
    // ---------------------------------------------------------
    "moov/trak/mdia/minf/stbl/stsz|variable": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            sampleSize:  "uint32",   // must be 0
            sampleCount: "uint32",
            sizes:       "uint32[]"
        }
    },

    // ---------------------------------------------------------
    // STSZ — fixed-size form (sampleSize != 0)
    // ---------------------------------------------------------
    "moov/trak/mdia/minf/stbl/stsz|fixed": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            sampleSize:  "uint32",   // constant sample size
            sampleCount: "uint32"
            // no sizes table
        }
    },

    /**
     * STCO — Chunk Offset Box
     *
     * Layout:
     *   uint32 entry_count
     *   uint32[entry_count] chunkOffsets
     */
    "moov/trak/mdia/minf/stbl/stco": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            entryCount:   "uint32",
            chunkOffsets: "uint32[]"
        }
    },

    /**
     * CO64 — Chunk Large Offset Box
     *
     * Layout:
     *   uint32 entry_count
     *   uint64[entry_count] chunkOffsets
     *
     * Note:
     * - uint64 table parsing is handled by its dedicated extractor.
     */
    "moov/trak/mdia/minf/stbl/co64": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            entryCount: "uint32",
            chunkOffsets: "uint64[]"
        }
    },

    /**
     * STSS — Sync Sample Box
     *
     * Layout:
     *   uint32 entry_count
     *   uint32[entry_count] sampleNumbers
     */
    "moov/trak/mdia/minf/stbl/stss": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            entryCount:    "uint32",
            sampleNumbers: "uint32[]"
        }
    },

    /**
     * CTTS — Composition Time To Sample
     *
     * Layout:
     *   uint32 entry_count
     *   { count, offset }[entry_count]
     */
    "moov/trak/mdia/minf/stbl/ctts": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            entryCount: "uint32",
            entries: [{
                count:  "uint32",
                offset: "uint32"
            }]
        }
    },

    /**
     * SBGP — Sample To Group Box
     *
     * Layout:
     *   uint32 grouping_type
     *   uint32 entry_count
     *   { sampleCount, groupDescriptionIndex }[entry_count]
     */
    "moov/trak/mdia/minf/stbl/sbgp": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            groupingType: "uint32",
            entryCount: "uint32",
            entries: [{
                sampleCount: "uint32",
                groupDescriptionIndex: "uint32"
            }]
        }
    },

    /**
     * SGPD — Sample Group Description Box
     *
     * Layout (version 1):
     *   uint32 grouping_type
     *   uint32 default_length
     *   uint32 entry_count
     *   description[entry_count]
     *
     * Notes:
     * - description entries are opaque byte arrays
     * - when default_length == 0, each description is length-prefixed (not handled yet)
     * - this schema reflects the emitter's current supported form
     */

    /**
     * SGPD — Sample Group Description Box (extractor envelope)
     *
     * This schema exists ONLY for extractor validation.
     * Actual layout is selected via |fixed or |variable variants.
     */
    "moov/trak/mdia/minf/stbl/sgpd": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            groupingType:  "uint32",
            defaultLength: "uint32",
            entryCount:    "uint32",

            // Union shape, extractor provides exact structure
            descriptions: "opaque"
        }
    },

    // sgpd with fixed-length descriptions (defaultLength != 0)
    "moov/trak/mdia/minf/stbl/sgpd|fixed": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            groupingType:  "uint32",
            defaultLength: "uint32",
            entryCount:    "uint32",
            descriptions: [{
                descriptionBytes: "opaque"
            }]
        }
    },

    // sgpd with variable-length descriptions (defaultLength == 0)
    "moov/trak/mdia/minf/stbl/sgpd|variable": {
        headerLayout: "Full",
        structuralRole: "terminal",
        fields: {
            groupingType:  "uint32",
            defaultLength: "uint32",
            entryCount:    "uint32",
            descriptions: [{
                descriptionLength: "uint32",
                descriptionBytes:  "opaque"
            }]
        }
    },

};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

export function getBoxSchemaForPath(path) {

    // 1. Exact match wins
    if (BOX_SCHEMAS[path]) {
        return BOX_SCHEMAS[path];
    }

    // 2. Wildcard match
    for (const [schemaPath, schema] of Object.entries(BOX_SCHEMAS)) {

        if (!schema.dynamicFourCC) continue;

        const pattern = schemaPath
            .replace("{atom}", "([^/]{4})");

        const regex = new RegExp(`^${pattern}$`);

        const match = path.match(regex);
        if (!match) continue;

        const fourcc = match[1];

        // 3. Enforce FourCC validity here
        if (fourcc.length !== 4) {
            throw new Error(
                `Invalid FourCC '${fourcc}' for '${schemaPath}'`
            );
        }

        return schema;
    }

    throw new Error(
        `No box schema registered for path '${path}'`
    );
}

export function getHeaderLayoutForPath(path) {
    const schema = getBoxSchemaForPath(path);
    const layout = HEADER_LAYOUTS[schema.headerLayout];

    if (!layout) {
        throw new Error(
            `Unknown headerLayout '${schema.headerLayout}' for '${path}'`
        );
    }

    return layout;
}

export function getPayloadOffsetForPath(path) {
    return getHeaderLayoutForPath(path).headerSize;
}

export function allowsIsoChildTraversal(path) {
    const schema = getBoxSchemaForPath(path);

    if (schema.structuralRole !== "container") {
        return false;
    }

    // Table containers (stsd) do not allow ISO child traversal
    if (schema.containerModel === "table") {
        return false;
    }

    // Explicit ISO child list required
    return Array.isArray(schema.children);
}
