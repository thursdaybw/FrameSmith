import { commitMoov } from "../commit/commitMoov.js";
import { assertEqual } from "./assertions.js";

export function testCommitMoov_Structure() {

    const originalTrak = emitTrakBox({
        tkhd: { type: "tkhd", body: [] },
        mdia: { type: "mdia", children: [] }
    });

    const committedTrak = emitTrakBox({
        tkhd: { type: "tkhd", body: [] },
        mdia: {
            type: "mdia",
            children: [{ type: "minf", children: [] }]
        }
    });

    const mvhdNode = { type: "mvhd", body: [] };

    const originalMoov = emitMoovBox({
        mvhd: mvhdNode,
        traks: [originalTrak]
    });

    const committedMoov = commitMoov({
        originalMoovNode: originalMoov,
        committedTrakNodes: [committedTrak]
    });

    const children = committedMoov.children;

    assertEqual("child[0].type", children[0].type, "mvhd");
    assertEqual("child[1].type", children[1].type, "trak");
    assertEqual("trak replaced", children[1] === committedTrak, true);

}
