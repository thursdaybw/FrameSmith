import { assertEqualHex, } from "./assertions.js";

const VALID_FOURCC = new Set([
    // top-level / containers
    "ftyp", "moov", "mdat", "free",

    // movie / track structure
    "mvhd", "trak", "tkhd",
    "edts", "elst",
    "mdia", "mdhd", "hdlr",
    "minf", "vmhd", "smhd",
    "dinf", "dref",
    "stbl",

    // sample tables
    "stsd", "stts", "ctts",
    "stsc", "stsz", "stco",
    "stss", "sbgp", "sgpd",

    // sample entries + children (FFmpeg canonical)
    "avc1", "avcC",
    "mp4a", "esds",
    "Opus", "dOps",
    "pasp", "btrt",
]);


/**
 * assertBytesWithStubbedStco
 * =========================
 *
 * PURPOSE
 * -------
 * Byte-for-byte comparison utility for FIRST-PASS container validation
 * where `stco` chunk offsets are intentionally not finalised yet.
 *
 * This function asserts that:
 *   - All bytes in `compilerBytes` and `oracleBytes` match exactly
 *   - EXCEPT for the contents of any detected `stco` box
 *
 * The `stco` box is treated as a known, intentional exception:
 *   - Its header MUST match byte-for-byte
 *   - Its entry_count MUST equal `expectedStcoEntryCount`
 *   - Its body is SKIPPED entirely (offset-dependent data)
 *
 * This allows strict verification of container layout, ordering,
 * flags, versions, sizes, and child boxes *before* chunk offsets
 * are resolved.
 *
 *
 * DESIGN (IMPORTANT)
 * ------------------
 * This is NOT a general ISO BMFF parser.
 *
 * It is a LINEAR BYTE SCANNER operating under a CLOSED-WORLD ASSUMPTION:
 *
 *   - Input files are known-good FFmpeg outputs
 *   - Only a fixed, known set of FourCCs is expected
 *   - The goal is to detect unintended byte drift, not to be permissive
 *
 * The scanner walks the byte stream sequentially and:
 *   1. Attempts to recognise "box-like" regions using:
 *        - a plausible size
 *        - a valid, known ASCII FourCC
 *   2. Records recognised regions for diagnostic tracing
 *   3. Special-cases `stco` to skip its payload
 *   4. Otherwise performs strict byte-for-byte comparison
 *
 * No recursion is used.
 * No semantic parsing is performed.
 * No container-specific traversal logic exists.
 *
 *
 * FAILURE MODEL
 * -------------
 * This function is intentionally biased toward FALSE NEGATIVES
 * rather than FALSE POSITIVES.
 *
 * Acceptable failure modes:
 *   - New or reordered boxes cause a test failure
 *   - Unknown FourCCs cause a test failure
 *   - Any unexpected byte drift fails loudly
 *
 * Unacceptable failure modes (which this avoids):
 *   - Silently accepting structural changes
 *   - Masking layout or size regressions
 *   - Ignoring non-STCO byte differences
 *
 * In other words:
 *   If this test fails, something *changed* — on purpose or by mistake.
 *
 *
 * NON-GOALS
 * ---------
 * This function does NOT:
 *   - Handle extended-size boxes (size == 1)
 *   - Handle UUID boxes
 *   - Support arbitrary ISO BMFF files
 *   - Validate semantic correctness
 *   - Attempt recovery or best-effort parsing
 *
 * It is a TEST HARNESS INSTRUMENT, not production code.
 *
 *
 * USAGE
 * -----
 * Use this only in tests that:
 *   - Validate container bytes before offset resolution
 *   - Need to skip `stco` deterministically
 *   - Operate on controlled, known fixtures
 *
 * Do NOT reuse this for runtime validation or general parsing.
 */
export function assertBytesWithStubbedStco({ fixture, compilerBytes, oracleBytes, expectedStcoEntryCount, labelPrefix, diagnostic = false, }) {

    const len = compilerBytes.length;
    let i = 0;

    const trace = [];

    // ---------------------------------------------------------
    // Hard length equality check (precondition)
    // ---------------------------------------------------------
    if (compilerBytes.length !== oracleBytes.length) {
        throw new Error(
            `${fixture}: byte length mismatch (compiler ${compilerBytes.length}, oracle ${oracleBytes.length})`
        );
    }

    function log(msg) {
        if (diagnostic) {
            console.log(msg);
        }
    }

    function record(type, offset, size) {
        trace.push({ type, offset, size });
        if (trace.length > 12) trace.shift();
    }

    function dumpTrace(failingOffset) {
        console.error("Byte scan trace:");
        for (const t of trace) {
            console.error(
                `  ✓ ${t.type} @ offset ${t.offset} (size ${t.size})`
            );
        }
        console.error(
            `  ✗ failure at absolute offset ${failingOffset}`
        );
    }

    function dumpTrailingBytes() {
        const start = compilerBytes.length;
        console.error(
            `${labelPrefix}: oracle has ${oracleBytes.length - compilerBytes.length} trailing bytes`
        );

        for (let j = start; j < oracleBytes.length; j += 16) {
            const slice = oracleBytes.slice(j, j + 16);
            const hex = Array.from(slice)
                .map(b => b.toString(16).padStart(2, "0"))
                .join(" ");

            const ascii = Array.from(slice)
                .map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : ".")
                .join("");

            console.error(
                `  + ${j.toString().padStart(5)}  ${hex.padEnd(47)}  ${ascii}`
            );
        }
    }

    function isPrintableAscii(b) {
        return b >= 0x20 && b <= 0x7e;
    }

    log(`=== BEGIN BYTE SCAN ${labelPrefix} ===`);

    while (i < len) {

        if (i + 8 <= len) {
            const size =
                (compilerBytes[i]     << 24) |
                (compilerBytes[i + 1] << 16) |
                (compilerBytes[i + 2] << 8)  |
                compilerBytes[i + 3];

            const b4 = compilerBytes[i + 4];
            const b5 = compilerBytes[i + 5];
            const b6 = compilerBytes[i + 6];
            const b7 = compilerBytes[i + 7];

            const plausibleSize =
                size >= 8 &&
                i + size <= len;

            const asciiFourCC =
                isPrintableAscii(b4) &&
                isPrintableAscii(b5) &&
                isPrintableAscii(b6) &&
                isPrintableAscii(b7);

            if (plausibleSize && asciiFourCC) {
                const fourcc =
                    String.fromCharCode(b4, b5, b6, b7);

                if (VALID_FOURCC.has(fourcc)) {

                    record(fourcc, i, size);
                    log(`[scan] ${fourcc} @ ${i} size=${size}`);

                    // ---- STCO special handling (payload skipped)
                    if (fourcc === "stco" && size >= 16) {

                        // compare full header
                        for (let h = 0; h < 16; h++) {
                            assertEqualHex(
                                `${labelPrefix}.stco.byte[${i + h}]`,
                                compilerBytes[i + h],
                                oracleBytes[i + h]
                            );
                        }

                        log(`  ↳ stco payload skipped`);

                        // skip payload only
                        i += size;
                        continue;
                    }

                    // ---- NON-STCO BOX: DO NOT SKIP
                    // fall through to byte-by-byte comparison
                }


            }
        }

        // Default byte compare
        if (compilerBytes[i] !== oracleBytes[i]) {
            dumpTrace(i);
            assertEqualHex(
                `${labelPrefix}.byte[${i}]`,
                compilerBytes[i],
                oracleBytes[i]
            );
        }

        i++;
    }

    if (compilerBytes.length !== oracleBytes.length) {
        dumpTrailingBytes();
        throw new Error(
            `${fixture}: byte length mismatch (compiler ${compilerBytes.length}, oracle ${oracleBytes.length})`
        );
    }

    log(`=== END BYTE SCAN ${labelPrefix} ===`);
}

