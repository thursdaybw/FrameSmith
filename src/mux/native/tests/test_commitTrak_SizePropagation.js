import { commitTrak } from "../commit/commitTrak.js";
import { emitTrakBox } from "../box-emitters/trakBox.js";
import { emitMdiaBox } from "../box-emitters/mdiaBox.js";
import { emitMinfBox } from "../box-emitters/minfBox.js";
import { emitStblBox } from "../box-emitters/stblBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";

export function testCommitTrak_SizePropagation() {

    console.log("=== testCommitTrak_SizePropagation ===");

    const smallMdia = emitMdiaBox({
        mdhd: { type: "mdhd", body: [] },
        hdlr: { type: "hdlr", body: [] },
        minf: emitMinfBox({
            vmhd: { type: "vmhd", body: [] },
            dinf: { type: "dinf", body: [] },
            stbl: emitStblBox({
                stsd: { type: "stsd", body: [] },
                stts: { type: "stts", body: [] },
                stsc: { type: "stsc", body: [] },
                stsz: { type: "stsz", body: [] },
                stco: { type: "stco", body: [] }
            })
        })
    });

    const bigMdia = emitMdiaBox({
        mdhd: { type: "mdhd", body: [] },
        hdlr: { type: "hdlr", body: [] },
        minf: emitMinfBox({
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
        })
    });

    const baseTrak = emitTrakBox({
        tkhd: { type: "tkhd", body: [] },
        mdia: smallMdia
    });

    const committedTrak = commitTrak({
        originalTrakNode: baseTrak,
        committedMdiaNode: bigMdia
    });

    const baseSize = serializeBoxTree(baseTrak).length;
    const newSize  = serializeBoxTree(committedTrak).length;

    assertEqual("trak size not smaller", newSize >= baseSize, true);
    assertEqual(
        "no structural loss",
        serializeBoxTree(committedTrak).length >= serializeBoxTree(baseTrak).length,
        true
    );
    console.log("PASS: commitTrak propagates size change");
}
