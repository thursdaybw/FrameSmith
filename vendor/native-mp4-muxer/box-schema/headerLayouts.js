/**
 * HEADER_LAYOUTS
 * ==============
 *
 * Defines how many bytes of header precede the payload of an MP4 box.
 *
 * This encodes ONLY header structure.
 * It deliberately does NOT encode:
 *   - containment
 *   - traversal
 *   - interpretation
 *
 * ISO/IEC 14496-12 terminology:
 * -----------------------------
 * - "Box"     → Basic header
 * - "FullBox" → Full header (version + flags)
 *
 * We avoid those names here because they confuse header layout
 * with structural role.
 */

export const HEADER_LAYOUTS = {

    /**
     * Basic
     * -----
     * size (4) + type (4)
     *
     * Total header size: 8 bytes
     *
     * Examples:
     *   moov, trak, mdia, minf, stbl,
     *   avcC, pasp, btrt
     */
    Basic: {
        headerSize: 8,
        hasVersion: false,
        hasFlags: false
    },

    /**
     * Full
     * ----
     * size (4) + type (4) + version (1) + flags (3)
     *
     * Total header size: 12 bytes
     *
     * Examples:
     *   stco, stts, stsc, stsz,
     *   mvhd, tkhd, mdhd,
     *   esds, meta
     */
    Full: {
        headerSize: 12,
        hasVersion: true,
        hasFlags: true,
        offsets: {
            version: 8,
            flags: 9
        }
    }

};
