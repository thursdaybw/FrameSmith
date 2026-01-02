import { commitMinf } from "../commit/commitMinf.js";
import { emitMinfBox } from "../box-emitters/minfBox.js";
import { assertEqual } from "./assertions.js";

export function testCommitMinf_Structure() {

    console.log("=== testCommitMinf_Structure ===");

    const originalStbl = { type: "stbl", body: ["old"] };
    const committedStbl = { type: "stbl", body: ["new"] };

    const originalMinf = emitMinfBox({
        vmhd: { type: "vmhd", body: [] },
        dinf: { type: "dinf", body: [] },
        stbl: originalStbl
    });

    const committedMinf = commitMinf({
        originalMinfNode: originalMinf,
        committedStblNode: committedStbl
    });

    const stbl = committedMinf.children.find(c => c.type === "stbl");

    assertEqual("stbl replaced", stbl.body[0], "new");

    console.log("PASS: commitMinf replaces stbl");
}
