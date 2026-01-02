import { serializeBoxTree } from "./serializer/serializeBoxTree.js";

/**
 * Resolve physical MP4 layout from fully-derived components.
 *
 * PASS 3 — STRUCTURE → PHYSICAL LAYOUT
 *
 * Responsibilities:
 *   - establish file-level box order
 *   - compute absolute box offsets
 *   - determine mdat header size
 *   - finalize absolute chunk offsets (stco only)
 *
 * NOTE:
 *   File ordering IS a layout policy.
 *   This implementation matches ffmpeg’s layout for the golden fixture.
 */
export function resolvePhysicalLayout({
    ftypNode,
    moovNode,
    mdatPayload,
    chunkOffsets
}) {
    if (!ftypNode) {
        throw new Error("resolvePhysicalLayout: ftypNode is required");
    }

    if (!moovNode) {
        throw new Error("resolvePhysicalLayout: moovNode is required");
    }

    if (!(mdatPayload instanceof Uint8Array)) {
        throw new Error("resolvePhysicalLayout: mdatPayload must be a Uint8Array");
    }

    if (!Array.isArray(chunkOffsets)) {
        throw new Error("resolvePhysicalLayout: chunkOffsets must be an array");
    }

    // ---------------------------------------------------------
    // 1. Serialize boxes for size accounting
    // ---------------------------------------------------------
    const ftypBytes = serializeBoxTree(ftypNode);
    const moovBytes = serializeBoxTree(moovNode);

    // ---------------------------------------------------------
    // 2. FFmpeg-compatible layout policy (LOCKED)
    //
    //   ftyp → free → mdat → moov
    //
    // free box is 8 bytes: size + "free"
    // ---------------------------------------------------------
    const FREE_BOX_SIZE = 8;

    const fileBoxOrder = ["ftyp", "free", "mdat", "moov"];

    // ---------------------------------------------------------
    // 3. Absolute box offsets
    // ---------------------------------------------------------
    const boxOffsets = {
        ftyp: 0,
        free: ftypBytes.length,
        mdat: ftypBytes.length + FREE_BOX_SIZE,
        moov:
            ftypBytes.length +
            FREE_BOX_SIZE +
            8 +                 // mdat header
            mdatPayload.length
    };

    // ---------------------------------------------------------
    // 4. MDAT header sizing
    // ---------------------------------------------------------
    const mdatHeaderSize = 8;

    const mdatDataOffset =
        boxOffsets.mdat + mdatHeaderSize;

    // ---------------------------------------------------------
    // 5. Chunk offset addressing decision
    // ---------------------------------------------------------
    const chunkOffsetType = "stco";

    // ---------------------------------------------------------
    // 6. Finalize absolute STCO offsets
    // ---------------------------------------------------------
    const stcoOffsets = chunkOffsets.map(rel =>
        mdatDataOffset + rel
    );

    for (let i = 1; i < stcoOffsets.length; i++) {
        if (stcoOffsets[i] <= stcoOffsets[i - 1]) {
            throw new Error(
                "resolvePhysicalLayout: chunk offsets must be strictly increasing"
            );
        }
    }

    return {
        fileBoxOrder,
        chunkOffsetType,
        boxOffsets,
        mdatHeaderSize,
        mdatDataOffset,
        stcoOffsets
    };
}
