import { 
    runGoldenMp4AVTestClient
} from "./clients/goldenMp4AVSourceClient.js";

import { createMp4FromInputs } from "../compiler/createMp4FromInputs.js";


import { asIsoBoxContainer } from "../box-model/Box.js";
import {
    readUint32,
    readUint32BE,
    readUint16BE,
} from "../bytes/mp4ByteReader.js";

import { readFourCC } from "../box-schema/boxLayoutReaders.js";

import {
    getHeaderLayoutForPath,
} from "../box-schema/boxSchemas.js";

import { describeMp4Byte } from "./reference/Mp4ByteContext.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EXTRACTOR_WIRING} from "./goldenTruthExtractors/GoldenTruthExtractorWiring.js";

import {
    extractBoxByPathFromMp4,
    extractChildBoxFromContainer,
} from "./reference/BoxExtractor.js";

import {
    assertEqual,
    assertExists,
    assertEqualHex,
} from "./assertions.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * End-to-end NativeMuxer conformance from frozen semantic fixtures.
 *
 * This file intentionally contains TWO tests that share the same
 * assembly pipeline but apply different correctness contracts.
 *
 * The distinction is fundamental.
 *
 * ---------------------------------------------------------------------------
 * The Three Tiers of MP4 Construction
 * ---------------------------------------------------------------------------
 *
 * Producing a real, usable MP4 requires THREE distinct categories of input.
 * Conflating them leads to dishonest tests and fragile architecture.
 *
 * Tier 1 — Semantic Media Facts
 * -----------------------------
 * These are facts that are intrinsic to the media itself.
 * They are true regardless of encoder, container, or tooling.
 *
 * Examples:
 *   - access unit bytes
 *   - presentation timestamps (PTS)
 *   - sample durations
 *   - keyframe markers (isKey)
 *   - codec identity (avc1, profile/level, SPS/PPS)
 *   - track and movie timescales
 *
 * Tier 1 answers the question:
 *   “What happened in time, and what bytes must be decoded?”
 *
 * The frozen semantic fixtures supply Tier 1.
 *
 *
 * Tier 2 — Container Policy Decisions
 * -----------------------------------
 * These are decisions required in practice to produce a widely-compatible,
 * inspectable, standards-conformant MP4, but which are NOT derivable from
 * semantic media facts alone.
 *
 * Examples:
 *   - exact SampleEntry defaults in stsd
 *   - presence and structure of optional-but-important boxes
 *   - default field values chosen by encoders (ffmpeg, MP4Box, etc.)
 *   - compatibility envelope decisions
 *
 * Two MP4 producers given the same Tier 1 semantics may legally choose
 * different Tier 2 values.
 *
 * Tier 2 answers the question:
 *   “What kind of MP4 do we emit by default?”
 *
 * In this codebase, Tier 2 is made EXPLICIT in the assembler.
 * It is not hidden in emitters, tests, or fixtures.
 *
 *
 * Tier 3 — Physical Layout Resolution
 * -----------------------------------
 * These are mechanical consequences of assembling the final file.
 *
 * Examples:
 *   - chunk offsets (stco)
 *   - box sizes
 *   - final byte positions
 *
 * Tier 3 answers the question:
 *   “Where do these bytes end up in the file?”
 *
 * Tier 3 is resolved only after full assembly and layout.
 *
 * ---------------------------------------------------------------------------
* Why There Are Two Tests In This File (there's not, yet)
* ---------------------------------------------------------------------------
*
* TEST A — Oracle Fidelity
* -----------------------
* Supplies the missing representational inputs extracted from the oracle
* MP4 (ffmpeg output), thereby providing Tier 1 + Tier 2 in full.
*
* This test asserts COMPLETE byte-for-byte equivalence.
*
* If this test fails, the compiler is incorrect.
    *
* TEST B — Semantic Canonical Assembly (planned non-existant)
    * -----------------------------------
    * Asserts that Tier 1 semantics PLUS explicit Tier 2 policy decisions
    * are SUFFICIENT to reproduce all MP4 bytes that are semantically
    * and policy-determined.
    *
    * This test intentionally DOES NOT assert full byte-for-byte equivalence
    * with the oracle MP4, because certain representational details are not
    * present in the semantic fixtures.
    *
    * Any mismatch outside the explicitly-declared exceptions is a HARD FAILURE.
    *
    * These guarantees are different.
    * They must never be conflated.
    */

// TEST A
async function runEndToEndCanonicalTest({ referencePath }) {

    const resp = await fetch(referencePath);
    const goldenMp4 = new Uint8Array(await resp.arrayBuffer());

    const mp4BuildInput = await runGoldenMp4AVTestClient({ mp4Bytes: goldenMp4 });

    return executeCanonicalAssertions({ mp4BuildInput, goldenMp4 });
}


export async function test_NativeMuxer_EndToEnd_FromMp4BuildInput_Canonical_AAC() {
    await runEndToEndCanonicalTest({ referencePath: "reference/reference_av.mp4" });
}

export async function test_NativeMuxer_EndToEnd_FromMp4BuildInput_Canonical_OPUS() {
    await runEndToEndCanonicalTest({ referencePath: "reference/reference_av_opus.mp4" });
}

export async function test_NativeMuxer_EndToEnd_FromMp4BuildInput_Canonical_AAC_AudioSpecificConfigOnly() {
    await runEndToEndCanonicalTest_AudioSpecificConfigOnly({ referencePath: "reference/reference_av.mp4" });
}

async function runEndToEndCanonicalTest_AudioSpecificConfigOnly({ referencePath }) {

    const resp = await fetch(referencePath);
    const goldenMp4 = new Uint8Array(await resp.arrayBuffer());

    const mp4BuildInput = await runGoldenMp4AVTestClient({ mp4Bytes: goldenMp4 });

    for (const track of mp4BuildInput.tracks) {
        if (track.semanticCore?.codec?.codec === "mp4a") {
            delete track.semanticCore.codec.esds;
        }
    }

    return executeCanonicalAssertions({ mp4BuildInput, goldenMp4 });
}

async function executeCanonicalAssertions({ mp4BuildInput, goldenMp4 }) {

    // ---------------------------------------------------------
    // Compile MP4 (debug object temporarily enabled)
    // ---------------------------------------------------------
    const outBytes = createMp4FromInputs(mp4BuildInput, goldenMp4);

    const goldT1Stts = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: goldenMp4,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stts"
        }
    ).readBoxReport();

    const prodT1Stts = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: outBytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stts"
        }
    ).readBoxReport();

    console.log(
        "=============================================\n",
        "goldT1Stts", goldT1Stts.box, 
        "\nprodT1Stts", prodT1Stts.box, 
        "\n=============================================\n",
    );

    const goldT1Stco = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: goldenMp4,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stco"
        }
    ).readBoxReport();

    const prodT1Stco = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: outBytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stco"
        }
    ).readBoxReport();


    console.log(
        "=============================================\n",
        "goldT1Stco", goldT1Stco.box, 
        "\nprodT1Stco", prodT1Stco.box, 
        "\n=============================================\n",
    );


    const goldT1Stsz = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: goldenMp4,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stsz"
        }
    ).readBoxReport();

    const prodT1Stsz = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: outBytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stsz"
        }
    ).readBoxReport();

    console.log(
        "=============================================\n",
        "goldT1Stsz", goldT1Stsz.box, 
        "\nprodT1Stsz", prodT1Stsz.box, 
        "\n=============================================\n",
    );


    const goldT1Stsc = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: goldenMp4,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stsc"
        }
    ).readBoxReport();

    const prodT1Stsc = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: outBytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stsc"
        }
    ).readBoxReport();

    console.log(
        "=============================================\n",
        "goldT1Stsc", goldT1Stsc.box, 
        "\nprodT1Stsc", prodT1Stsc.box, 
        "\n=============================================\n",
    );


    console.log("ORACLE ftyp bytes:", goldenMp4.slice(0, 64));
    console.log("PRODUCED ftyp bytes:", outBytes.slice(0, 64));

    const oracleResults = probeOracleSelectors({
        bytes: goldenMp4,
        selectors: SELECTORS
    });

    const producedResults = probeOracleSelectors({
        bytes: outBytes,
        selectors: SELECTORS
    });

    printSideBySideTable({ oracleResults, producedResults });

    const track1BoxGold = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: goldenMp4,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]"
        }
    ).readBoxReport();

    const track1BoxProd = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: outBytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov/trak[1]"
        }
    ).readBoxReport();

    // -----------------------------------------------------
    // Track[1] equivalence
    // -----------------------------------------------------
    if (track1BoxProd.length !== track1BoxGold.length) {
        console.log(
            "trak[1] length mismatch:",
            "oracle =", track1BoxGold.length,
            "produced =", track1BoxProd.length
        );
    }

    for (let i = 0; i < track1BoxGold.length; i++) {
        assertEqualHex(
            `track1.byte[${i}]`,
            track1BoxProd[i],
            track1BoxGold[i]
        );
    }

    const mdatBoxGold = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: goldenMp4,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "mdat"
        }
    ).readBoxReport();

    const mdatBoxProd = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: outBytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "mdat"
        }
    ).readBoxReport();

    console.log("mdatBoxGold.box.fields", mdatBoxGold.box); 
    console.log("mdatBoxProd.box.fields", mdatBoxProd.box); 
    console.log(
        "mdat[1] length:",
        "oracle =", mdatBoxGold.raw.length,
        "produced =", mdatBoxProd.raw.length
    );

    console.log(
        "gold mdat slice:",
        Array.from(mdatBoxGold.raw.slice(8, 24))
    );

    console.log(
        "prod mdat slice:",
        Array.from(mdatBoxProd.raw.slice(8, 24))
    );
    const ftypBoxGold = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: goldenMp4,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "ftyp"
        }
    ).readBoxReport();

    const ftypBoxProd = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: outBytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "ftyp"
        }
    ).readBoxReport();

    console.log("ftypBoxGold.box.fields", ftypBoxGold.box.fields); 
    console.log("ftypBoxProd.box.fields", ftypBoxProd.box.fields); 

    for (let i = 0; i < ftypBoxGold.raw.length; i++) {
        assertEqualHex(
            `ftyp.byte[${i}]`,
            ftypBoxGold.raw[i],
            ftypBoxProd.raw[i]
        );
    }

    const freeBoxGold = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: goldenMp4,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "free"
        }
    ).readBoxReport();

    const freeBoxProd = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: outBytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "free"
        }
    ).readBoxReport();

    for (let i = 0; i < freeBoxGold.raw.length; i++) {
        assertEqualHex(
            `free.byte[${i}]`,
            freeBoxGold.raw[i],
            freeBoxProd.raw[i]
        );
    }

    // -----------------------------------------------------
    // mDat header
    // -----------------------------------------------------
    const mdatBytes = getGoldenTruthBox .getSemanticBoxDataFromBox(
        {
            boxBytes: outBytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "mdat"
        }
    ).readBoxReport().raw;

    dumpHeaderAscii({boxBytes: mdatBytes, path:"mdat"});

    // -----------------------------------------------------
    // Full MP4 byte-for-byte equivalence
    // -----------------------------------------------------
    if (outBytes.length !== goldenMp4.length) {
        throw new Error(
            `MP4 length mismatch: oracle=${goldenMp4.length}, produced=${outBytes.length}`
        );
    }

    for (let i = 0; i < goldenMp4.length; i++) {
        assertEqualHex(
            `mp4.byte[${i}]`,
            outBytes[i],
            goldenMp4[i]
        );
    }

    // ---------------------------------------------------------
    // Optional download (manual inspection)
    // ---------------------------------------------------------
    if (window.DEBUG_DOWNLOAD_MP4 === true) {
        console.log("[DEBUG] Downloading canonical MP4…");
        downloadMp4(outBytes, "canonical-native-muxer.mp4");
    }
}

export const SELECTORS = [
    "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/dOps",
    "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/esds",
    "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/btrt",
    "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/pasp",
    "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/avcC",
    "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]",
    "moov/trak[1]/mdia/minf/stbl/stsd",
    "moov/trak[1]/mdia/minf/stbl/stco",
    "moov/trak[1]/mdia/minf/stbl/stsz",
    "moov/trak[1]/mdia/minf/stbl/stss",
    "moov/trak[1]/mdia/minf/stbl/stsc",
    "moov/trak[1]/mdia/minf/stbl/stts",
    "moov/trak[1]/mdia/minf/stbl/ctts",
    "moov/trak[1]/mdia/minf/stbl/sgpd",
    "moov/trak[1]/mdia/minf/stbl/sbgp",
    "moov/trak[1]/mdia/minf/stbl",
    "moov/trak[1]/mdia/minf/dinf/dref",
    "moov/trak[1]/mdia/minf/dinf",
    "moov/trak[1]/mdia/minf/smhd",
    "moov/trak[1]/mdia/minf",
    "moov/trak[1]/mdia/mdhd",
    "moov/trak[1]/mdia/hdlr",
    "moov/trak[1]/mdia",
    "moov/trak[1]/edts/elst",
    "moov/trak[1]/edts",
    "moov/trak[1]/tkhd",
    "moov/trak[1]",
    "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/dOps",
    "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/esds",
    "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/pasp",
    "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/btrt",
    "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC",
    "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]",
    "moov/trak[0]/mdia/minf/stbl/stsd",
    "moov/trak[0]/mdia/minf/stbl/stco",
    "moov/trak[0]/mdia/minf/stbl/stsz",
    "moov/trak[0]/mdia/minf/stbl/stss",
    "moov/trak[0]/mdia/minf/stbl/stsc",
    "moov/trak[0]/mdia/minf/stbl/stts",
    "moov/trak[0]/mdia/minf/stbl",
    "moov/trak[0]/mdia/minf/dinf/dref",
    "moov/trak[0]/mdia/minf/dinf",
    "moov/trak[0]/mdia/minf/vmhd",
    "moov/trak[0]/mdia/minf",
    "moov/trak[0]/mdia/mdhd",
    "moov/trak[0]/mdia/hdlr",
    "moov/trak[0]/mdia",
    "moov/trak[0]/edts/elst",
    "moov/trak[0]/edts",
    "moov/trak[0]/tkhd",
    "moov/trak[0]",
    "moov/udta/meta/ilst/©too",
    "moov/udta/meta/ilst",
    "moov/udta/meta/hdlr",
    "moov/udta/meta",
    "moov/udta",
    "moov/mvhd",
    "moov",
    "free",
    "ftyp",
    "mdat",
];

//"moov/udta/meta/ilst/©too/data",

function printSideBySideTable({ oracleResults, producedResults }) {

    const map = new Map();

    for (const r of oracleResults) {
        map.set(r.selector, { selector: r.selector, oracle: r });
    }

    for (const r of producedResults) {
        const entry = map.get(r.selector) || { selector: r.selector };
        entry.produced = r;
        map.set(r.selector, entry);
    }

    const rows = [...map.values()]

    const pad = (s, n) => String(s ?? "").padStart(n);
    const padEnd = (s, n) => String(s ?? "").padEnd(n);

    console.log(
        padEnd("SELECTOR", 55) +
        pad("ORACLE", 10) +
        pad("PRODUCED", 12) +
        pad("Δ", 8)
    );

    console.log("-".repeat(85));

    for (const r of rows) {

        const o = r.oracle?.size;
        const p = r.produced?.size;

        const delta =
            o !== undefined && p !== undefined
            ? p - o
            : "";

        console.log(
            padEnd(r.selector, 55) +
            pad(o ?? "—", 10) +
            pad(p ?? "—", 12) +
            pad(delta === "" ? "" : (delta > 0 ? `+${delta}` : delta), 8)
        );
    }
}

function probeOracleSelectors({ bytes, selectors }) {

    const results = [];

    for (const selector of selectors) {

        try {
            const box =
                getGoldenTruthBox
                .getSemanticBoxDataFromBox({
                    boxBytes: bytes,
                    sourceRegistryKey: "$mp4",
                    targetBoxPath: selector
                });

            results.push({
                selector,
                status: "OK",
                size: box.readBoxReport().raw.length
            });

        } catch (e) {
            results.push({
                selector,
                status: "MISSING",
                reason: e.message
            });
        }
    }

    return results;
}

function dumpHeaderAscii({ boxBytes, path }) {

    // Ask the schema how big the header for this box is
    const headerLayout = getHeaderLayoutForPath(path);
    const headerSize = headerLayout.headerSize;

    // Walk through each byte in the header
    for (let offset = 0; offset < headerSize; offset++) {

        // Read the raw byte value (0–255)
        const byteValue = boxBytes[offset];

        // Convert the byte to a character
        const character = String.fromCharCode(byteValue);

        // Decide if this character is a normal, readable ASCII character.
        // Printable ASCII characters live between space (32) and tilde (126).
        let printableCharacter;

        if (byteValue >= 32 && byteValue <= 126) {
            printableCharacter = character;
        } else {
            // Anything else is control data or binary, so show a dot
            printableCharacter = ".";
        }

        // Print the offset, decimal value, and printable character
        console.log(
            "offset " + offset +
            " | dec " + byteValue +
            " | '" + printableCharacter + "'"
        );
    }
}


// ============================================================
// STRUCTURAL COMPARISON (container + child layout)
// ============================================================


function downloadMp4(bytes, filename) {
    const blob = new Blob([bytes], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
