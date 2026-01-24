import { commitMdia } from "../commit/commitMdia.js";
import { assertEqual } from "./assertions.js";

export function testCommitMdia_Structure() {

    const mdhdNode = { type: "mdhd", body: [] };
    const hdlrNode = { type: "hdlr", body: [] };
    const elngNode = { type: "elng", body: [] };

    const originalMinf = emitMinfBox({
        mediaHeader: { type: "vmhd", body: [] },
        dinf: { type: "dinf", body: [] },
        stbl: { type: "stbl", children: [] }
    });

    const committedMinf = emitMinfBox({
        mediaHeader: { type: "vmhd", body: [] },
        dinf: { type: "dinf", body: [] },
        stbl: { type: "stbl", children: [{ type: "stts", body: [] }] }
    });

    const originalMdia = {
        type: "mdia",
        children: [
            mdhdNode,
            hdlrNode,
            elngNode,
            originalMinf
        ]
    };

    const committedMdia = commitMdia({
        originalMdiaNode: originalMdia,
        committedMinfNode: committedMinf
    });

    const children = committedMdia.children;

    assertEqual("child count preserved", children.length, 4);

    assertEqual("mdhd preserved", children[0] === mdhdNode, true);
    assertEqual("hdlr preserved", children[1] === hdlrNode, true);
    assertEqual("elng preserved", children[2] === elngNode, true);
    assertEqual("minf replaced", children[3] === committedMinf, true);

}
