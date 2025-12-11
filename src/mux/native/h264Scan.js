/**
 * scanAnnexB
 * ----------
 * Convert Annex-B formatted bytes into an array of raw NAL payloads.
 *
 * Each element in the returned list is:
 *    { payloadStart, payloadEnd }
 *
 * This scanner:
 *   - Recognises only genuine start codes (00 00 01 and 00 00 00 01)
 *   - Avoids false positives inside slice data
 *   - Treats emulation prevention correctly (00 00 03)
 *
 * It does NOT modify payload bytes. It does NOT remove EPB bytes.
 * The decoder / MP4 consumer handles EPB removal.
 *
 * This function ONLY identifies boundaries cleanly.
 */

export function scanAnnexB(bytes) {
    const len = bytes.length;
    const units = [];

    let i = 0;

    while (i < len) {

        // Find the next genuine start code
        const start = findStartCode(bytes, i);
        if (!start) break;

        const { headerIndex, payloadIndex } = start;

        // Find the next start code after this one
        const next = findStartCode(bytes, payloadIndex);

        const nalEnd = next ? next.headerIndex : len;

        // Ignore empty payloads
        if (payloadIndex < nalEnd) {
            units.push({
                payloadStart: payloadIndex,
                payloadEnd: nalEnd
            });
        }

        i = nalEnd;
    }

    return units;
}


/**
 * findStartCode
 * --------------
 * Return null or:
 *   {
 *      headerIndex: index of first byte of start code
 *      payloadIndex: index of first byte AFTER start code
 *   }
 *
 * Requirements:
 *   - Accept both 3-byte and 4-byte Annex-B patterns
 *   - Reject false positives from inside data
 *
 * Logic:
 *   We accept only:
 *      00 00 01
 *      00 00 00 01
 *
 *   BUT we require that the byte before the pattern,
 *   when it exists, is NOT 0x03 (emulation-prevention),
 *   because 00 00 03 01 is NOT a start code.
 */
function findStartCode(bytes, from) {
    const len = bytes.length;

    for (let i = from; i + 3 < len; i++) {

        // Check 3-byte pattern: 00 00 01
        if (bytes[i] === 0 && bytes[i+1] === 0 && bytes[i+2] === 1) {

            // Reject if preceded by emulation-prevention (00 00 03 01)
            if (i > 0 && bytes[i - 1] === 0x03) continue;

            return {
                headerIndex: i,
                payloadIndex: i + 3
            };
        }

        // Check 4-byte pattern: 00 00 00 01
        if (bytes[i] === 0 && bytes[i+1] === 0 && bytes[i+2] === 0 && bytes[i+3] === 1) {

            // Reject if preceded by emulation-prevention
            if (i > 0 && bytes[i - 1] === 0x03) continue;

            return {
                headerIndex: i,
                payloadIndex: i + 4
            };
        }
    }

    return null;
}
