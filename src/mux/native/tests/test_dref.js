import { buildDrefBox } from "../boxes/drefBox.js";
import { readType, readUint32 } from "./testUtils.js";

export function testDref() {
    console.log("=== testDref ===");

    const box = buildDrefBox();

    if (readType(box, 4) !== "dref") {
        throw new Error("FAIL: dref type incorrect");
    }

    if (readUint32(box, 0) !== box.length) {
        throw new Error("FAIL: dref size mismatch");
    }

    console.log("PASS: dref tests");
}
