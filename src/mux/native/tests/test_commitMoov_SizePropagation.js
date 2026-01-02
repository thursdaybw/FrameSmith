import { commitMoov } from "../commit/commitMoov.js";
import { emitMoovBox } from "../box-emitters/moovBox.js";
import { emitTrakBox } from "../box-emitters/trakBox.js";
import { emitMdiaBox } from "../box-emitters/mdiaBox.js";
import { emitMinfBox } from "../box-emitters/minfBox.js";
import { emitStblBox } from "../box-emitters/stblBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";

export function testCommitMoov_SizePropagation() {

    console.log("=== testCommitMoov_SizePropagation ===");

    const smallTrak = emitTrakBox({
        tkhd: { type: "tkhd", body: [] },
        mdia: emitMdiaBox({
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
        })
    });

    const bigTrak = emitTrakBox({
        tkhd: { type: "tkhd", body: [] },
        mdia: emitMdiaBox({
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
        })
    });

    const baseMoov = emitMoovBox({
        mvhd: { type: "mvhd", body: [] },
        traks: [smallTrak]
    });

    const committedMoov = commitMoov({
        originalMoovNode: baseMoov,
        committedTrakNodes: [bigTrak]
    });

    const baseSize = serializeBoxTree(baseMoov).length;
    const newSize  = serializeBoxTree(committedMoov).length;

    assertEqual("moov size increased", newSize > baseSize, true);

    console.log("PASS: commitMoov propagates size change");
}
