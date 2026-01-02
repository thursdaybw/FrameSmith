import { commitStbl } from "../commit/commitStbl.js";
import { assertEqual } from "./assertions.js";

export function testCommitStbl_PreservesAllChildrenAndReplacesStco() {

    console.log("=== testCommitStbl_PreservesAllChildrenAndReplacesStco ===");

    const stsd = { type: "stsd" };
    const stts = { type: "stts" };
    const stss = { type: "stss" };
    const ctts = { type: "ctts" };
    const stsc = { type: "stsc" };
    const stsz = { type: "stsz" };
    const oldStco = { type: "stco", body: ["OLD"] };
    const newStco = { type: "stco", body: ["NEW"] };

    const originalStblNode = {
        type: "stbl",
        children: [
            stsd,
            stts,
            stss,
            ctts,
            stsc,
            stsz,
            oldStco
        ]
    };

    const out = commitStbl({
        originalStblNode,
        committedStcoNode: newStco
    });

    assertEqual("child count preserved", out.children.length, 7);

    assertEqual("stsd preserved", out.children[0] === stsd, true);
    assertEqual("stts preserved", out.children[1] === stts, true);
    assertEqual("stss preserved", out.children[2] === stss, true);
    assertEqual("ctts preserved", out.children[3] === ctts, true);
    assertEqual("stsc preserved", out.children[4] === stsc, true);
    assertEqual("stsz preserved", out.children[5] === stsz, true);
    assertEqual("stco replaced", out.children[6] === newStco, true);

    console.log("PASS: commitStbl preserves all children and replaces STCO");
}

export function testCommitStbl_InsertsStcoWhenMissing() {

    console.log("=== testCommitStbl_InsertsStcoWhenMissing ===");

    const stsd = { type: "stsd" };
    const stts = { type: "stts" };
    const stss = { type: "stss" };
    const ctts = { type: "ctts" };
    const stsc = { type: "stsc" };
    const stsz = { type: "stsz" };
    const newStco = { type: "stco" };

    const originalStblNode = {
        type: "stbl",
        children: [
            stsd,
            stts,
            stss,
            ctts,
            stsc,
            stsz
        ]
    };

    const out = commitStbl({
        originalStblNode,
        committedStcoNode: newStco
    });

    assertEqual("child count", out.children.length, 7);
    assertEqual("stco appended", out.children[6] === newStco, true);

    console.log("PASS: commitStbl inserts STCO without losing children");
}
