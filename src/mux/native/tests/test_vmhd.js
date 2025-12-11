import { buildVmhdBox } from "../boxes/vmhdBox.js";
import { readType, readUint32 } from "./testUtils.js";

export function testVmhd() {
    console.log("=== testVmhd ===");

    const box = buildVmhdBox();

    if (readType(box, 4) !== "vmhd") {
        throw new Error("FAIL: vmhd type incorrect");
    }

    if (readUint32(box, 0) !== box.length) {
        throw new Error("FAIL: vmhd size mismatch");
    }

    console.log("PASS: vmhd tests");
}
