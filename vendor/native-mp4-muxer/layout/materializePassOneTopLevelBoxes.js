import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

/**
 * materializePassOneTopLevelBoxes
 * ===============================
 *
 * Purpose
 * -------
 * Materializes top-level MP4 boxes that appear *before* MDAT,
 * in file order, so their byte sizes can be measured.
 *
 * This pass exists solely to determine the MDAT start offset.
 *
 * Design constraints
 * ------------------
 * - Iterates fileBoxOrder in order
 * - STOPS when encountering "mdat"
 * - Serializes only boxes that exist *before* MDAT
 * - Does NOT materialize MDAT
 * - Does NOT look past MDAT
 * - Does NOT mutate compiler state
 *
 * Inputs
 * ------
 * - topLevelNodes: { [boxType]: Node }
 * - fileBoxOrder:  string[]
 *
 * Returns
 * -------
 * Array of:
 *   {
 *     type: string,
 *     bytes: Uint8Array,
 *     byteLength: number
 *   }
 */
export function materializePassOneTopLevelBoxes({ topLevelNodes, fileBoxOrder }) {

    if (!topLevelNodes) {
        throw new Error(
            "materializePassOneTopLevelBoxes: topLevelNodes is required"
        );
    }

    if (!Array.isArray(fileBoxOrder)) {
        throw new Error(
            "materializePassOneTopLevelBoxes: fileBoxOrder must be an array"
        );
    }

    const boxes = [];

    for (const boxType of fileBoxOrder) {

        // MDAT is a hard stop for pass one
        if (boxType === "mdat") {
            break;
        }

        const node = topLevelNodes[boxType];

        if (!node) {
            throw new Error(
                `materializePassOneTopLevelBoxes: missing top-level node for "${boxType}"`
            );
        }

        const bytes = serializeBoxTree(node);

        if (!(bytes instanceof Uint8Array)) {
            throw new Error(
                `materializePassOneTopLevelBoxes: serialization of "${boxType}" did not return Uint8Array`
            );
        }

        boxes.push({
            type: boxType,
            bytes,
            byteLength: bytes.length
        });
    }

    return boxes;
}
