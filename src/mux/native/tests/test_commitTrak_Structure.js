import { commitTrak } from "../commit/commitTrak.js";
import { assertEqual } from "./assertions.js";

export function testCommitTrak_Structure() {

    console.log("=== testCommitTrak_Structure ===");

    const tkhdNode = { type: "tkhd", body: [] };
    const edtsNode = { type: "edts", children: [] };

    const originalMdia = {
        type: "mdia",
        children: [
            { type: "mdhd", body: [] },
            { type: "hdlr", body: [] },
            { type: "minf", children: [] }
        ]
    };

    const committedMdia = {
        type: "mdia",
        children: [
            { type: "mdhd", body: [] },
            { type: "hdlr", body: [] },
            { type: "minf", children: [{ type: "vmhd", body: [] }] }
        ]
    };

    const originalTrak = {
        type: "trak",
        children: [
            tkhdNode,
            edtsNode,
            originalMdia
        ]
    };

    const committedTrak = commitTrak({
        originalTrakNode: originalTrak,
        committedMdiaNode: committedMdia
    });

    const children = committedTrak.children;

    assertEqual("child count preserved", children.length, 3);
    assertEqual("tkhd preserved", children[0] === tkhdNode, true);
    assertEqual("edts preserved", children[1] === edtsNode, true);
    assertEqual("mdia replaced", children[2] === committedMdia, true);

    console.log("PASS: commitTrak preserves structure and replaces mdia only");
}
