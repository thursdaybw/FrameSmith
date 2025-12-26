import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
export async function testSerializer() {
    console.log("=== testSerializer ===");

    // -----------------------------------------------------------
    // 1. int field
    // -----------------------------------------------------------
    let node = {
        type: "test",
        body: [
            { int: 123456 }
        ]
    };

    let bytes = serializeBoxTree(node);

    if (readUint32(bytes, 0) !== 12) {
        throw new Error("FAIL: int size incorrect");
    }

    if (readFourCC(bytes, 4) !== "test") {
        throw new Error("FAIL: int type incorrect");
    }

    if (readUint32(bytes, 8) !== 123456) {
        throw new Error("FAIL: int field incorrect");
    }

    // -----------------------------------------------------------
    // 2. version + numeric flags (allowed: 0 or 1)
    // -----------------------------------------------------------
    node = {
        type: "test",
        version: 1,
        flags: 1,
        body: [
            { int: 99 }
        ]
    };

    bytes = serializeBoxTree(node);

    if (readUint32(bytes, 0) !== 16) {
        throw new Error("FAIL: versioned size incorrect");
    }

    if (bytes[8] !== 1) {
        throw new Error("FAIL: version incorrect");
    }

    if (bytes[9] !== 0 || bytes[10] !== 0 || bytes[11] !== 1) {
        throw new Error("FAIL: numeric flags incorrect");
    }

    if (readUint32(bytes, 12) !== 99) {
        throw new Error("FAIL: versioned body field incorrect");
    }

    // -----------------------------------------------------------
    // 3. named flags (multi-bit)
    // -----------------------------------------------------------
    node = {
        type: "test",
        version: 0,
        flags: {
            alpha: true,
            beta: false
        },
        flagBits: {
            alpha: 0x000001,
            beta:  0x000002
        },
        body: []
    };

    bytes = serializeBoxTree(node);

    if (bytes[9] !== 0 || bytes[10] !== 0 || bytes[11] !== 1) {
        throw new Error("FAIL: named flags encoding incorrect");
    }

    // -----------------------------------------------------------
    // 4. reject invalid numeric flags
    // -----------------------------------------------------------
    let threw = false;

    try {
        serializeBoxTree({
            type: "test",
            version: 0,
            flags: 0x010203,
            body: []
        });
    } catch (err) {
        threw = true;
    }

    if (!threw) {
        throw new Error(
            "FAIL: serializer accepted invalid numeric flags"
        );
    }

    // -----------------------------------------------------------
    // 5. array of int
    // -----------------------------------------------------------
    node = {
        type: "test",
        body: [
            { array: "int", values: [1, 2, 3] }
        ]
    };

    bytes = serializeBoxTree(node);

    if (readUint32(bytes, 8) !== 1) throw new Error("FAIL: array[0] incorrect");
    if (readUint32(bytes, 12) !== 2) throw new Error("FAIL: array[1] incorrect");
    if (readUint32(bytes, 16) !== 3) throw new Error("FAIL: array[2] incorrect");

    // -----------------------------------------------------------
    // 6. nested child box
    // -----------------------------------------------------------
    const child = {
        type: "chil",
        body: [{ int: 777 }]
    };

    node = {
        type: "pare",
        body: [{ int: 123 }],
        children: [child]
    };

    bytes = serializeBoxTree(node);

    if (readFourCC(bytes, 4) !== "pare") {
        throw new Error("FAIL: parent type incorrect");
    }

    if (readUint32(bytes, 8) !== 123) {
        throw new Error("FAIL: parent field incorrect");
    }

    const childOffset = 12;

    if (readFourCC(bytes, childOffset + 4) !== "chil") {
        throw new Error("FAIL: child type incorrect");
    }

    if (readUint32(bytes, childOffset + 8) !== 777) {
        throw new Error("FAIL: child field incorrect");
    }

    // -----------------------------------------------------------
    // 7. opaque passthrough payload (allowed only in mdat)
    // -----------------------------------------------------------
    node = {
        type: "mdat",
        body: [
            { OpaqueBytesPassthrough: new Uint8Array([9, 8, 7, 6]) }
        ]
    };

    bytes = serializeBoxTree(node);

    if (
        bytes[8] !== 9 ||
        bytes[9] !== 8 ||
        bytes[10] !== 7 ||
        bytes[11] !== 6
    ) {
        throw new Error("FAIL: mdat bytes field incorrect");
    }

    // -----------------------------------------------------------
    // 8. FourCC field inside body
    // -----------------------------------------------------------
    node = {
        type: "test",
        body: [
            { type: "abcd" }
        ]
    };

    bytes = serializeBoxTree(node);

    const fourCC =
        String.fromCharCode(bytes[8]) +
        String.fromCharCode(bytes[9]) +
        String.fromCharCode(bytes[10]) +
        String.fromCharCode(bytes[11]);

    if (fourCC !== "abcd") {
        throw new Error("FAIL: FourCC field incorrect");
    }

    // -----------------------------------------------------------
    // 9. reject raw box node in body (DSL violation)
    // -----------------------------------------------------------
    let threwDslViolation = false;

    try {
        serializeBoxTree({
            type: "test",
            body: [
                { int: 1 },
                {
                    type: "chil",
                    body: []
                }
            ]
        });
    } catch (err) {
        threwDslViolation = true;
    }

    if (!threwDslViolation) {
        throw new Error(
            "FAIL: serializer accepted raw box node in body"
        );
    }

    // -----------------------------------------------------------
    // 10. accept wrapped box node in body
    // -----------------------------------------------------------
    const wrapped = serializeBoxTree({
        type: "test",
        body: [
            { int: 1 },
            { box: { type: "chil", body: [] } }
        ]
    });

    if (readFourCC(wrapped, 4) !== "test") {
        throw new Error("FAIL: wrapped body box not serialized correctly");
    }

    // -----------------------------------------------------------
    // 11. reject opaque passthrough outside mdat
    // -----------------------------------------------------------
    let rejected = false;

    try {
        serializeBoxTree({
            type: "test",
            body: [
                { OpaqueBytesPassthrough: new Uint8Array([1]) }
            ]
        });
    } catch {
        rejected = true;
    }

    if (!rejected) {
        throw new Error("FAIL: OpaqueBytesPassthrough allowed outside mdat");
    }

    console.log("PASS: Serializer tests");
}
