import { commitMdia } from "../commit/commitMdia.js";
import { emitMdiaBox } from "../box-emitters/mdiaBox.js";
import { emitMinfBox } from "../box-emitters/minfBox.js";
import { emitStblBox } from "../box-emitters/stblBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";

export function testCommitMdia_SizePropagation() {

    console.log("=== testCommitMdia_SizePropagation ===");

    const smallMinf = emitMinfBox({
        vmhd: { type: "vmhd", body: [] },
        dinf: { type: "dinf", body: [] },
        stbl: emitStblBox({
            stsd: { type: "stsd", body: [] },
            stts: { type: "stts", body: [] },
            stsc: { type: "stsc", body: [] },
            stsz: { type: "stsz", body: [] },
            stco: { type: "stco", body: [] }
        })
    });

    const bigMinf = emitMinfBox({
        vmhd: { type: "vmhd", body: [] },
        dinf: { type: "dinf", body: [] },
        stbl: emitStblBox({
            stsd: { type: "stsd", body: [] },
            stts: {
                type: "stts",
                body: [{ int: 1 }, { int: 1000 }]
            },
            stsc: { type: "stsc", body: [] },
            stsz: { type: "stsz", body: [] },
            stco: { type: "stco", body: [] }
        })
    });

    const baseMdia = {
        type: "mdia",
        children: [
            { type: "mdhd", body: [] },
            { type: "hdlr", body: [] },
            { type: "elng", body: [] }, // extra child
            smallMinf
        ]
    };

    const committedMdia = commitMdia({
        originalMdiaNode: baseMdia,
        committedMinfNode: bigMinf
    });

    const baseSize = serializeBoxTree(baseMdia).length;
    const newSize  = serializeBoxTree(committedMdia).length;

    assertEqual("mdia size not smaller", newSize >= baseSize, true);

    assertEqual(
        "no structural loss",
        serializeBoxTree(committedMdia).length >= serializeBoxTree(baseMdia).length,
        true
    );
    console.log("PASS: commitMdia propagates size change");
}
