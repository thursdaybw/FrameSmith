export function assertEqual(name, actual, expected, message) {
    if (actual !== expected) {
        const header = message
            ? `FAIL: ${message}`
            : `FAIL: ${name} mismatch`;

        throw new Error(
            `${header}\n` +
            `Expected: ${expected}\n` +
            `Actual:   ${actual}`
        );
    }
}

export function assertEqualHex(name, actual, expected) {
    if (actual !== expected) {
        throw new Error(
            `FAIL: ${name} mismatch\n` +
            `Expected: 0x${expected.toString(16)}\n` +
            `Actual:   0x${actual.toString(16)}`
        );
    }
}

export function assertExists(name, value) {
    if (!value) {
        throw new Error(`FAIL: missing required ${name}`);
    }
}

export function assertNoRawBytes(node, path = "root") {
    if (!node || typeof node !== "object") {
        return;
    }

    if (Array.isArray(node.body)) {
        for (const part of node.body) {
            if (part && typeof part === "object" && "bytes" in part) {
                throw new Error(
                    `Raw byte passthrough detected at ${path}.body — ` +
                    `raw bytes are forbidden outside mdat`
                );
            }
        }
    }

    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            assertNoRawBytes(child, `${path}/${child.type}`);
        }
    }
}

