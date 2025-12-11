import { buildHdlrBox } from "../boxes/hdlrBox.js";
import { readType, readUint32 } from "./testUtils.js";

export function testHdlr() {
    console.log("=== testHdlr ===");

    const box = buildHdlrBox();

    if (readType(box, 4) !== "hdlr") {
        throw new Error("FAIL: hdlr type incorrect");
    }

    const size = readUint32(box, 0);
    if (size !== box.length) {
        throw new Error("FAIL: hdlr size mismatch");
    }

    console.log("PASS: hdlr tests");
}
