import { readFourCC } from "../box-schema/boxLayoutReaders.js";

export class SkipTestError extends Error {
    constructor(message) {
        super(message);
        this.name = "SkipTestError";
    }
}

export function skipTest(reason) {
    throw new SkipTestError(reason);
}

export function assertEqual(message, actual, expected) {

    if (!deepEqual(actual, expected)) {
        throw new Error(
            `FAIL: ${message}\n` +
            `Expected:\n${pretty(expected)}\n` +
            `Actual:\n${pretty(actual)}`
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

export function assertEqualHexCollect(diffs, name, actual, expected) {
    if (actual !== expected) {
        diffs.push({
            name,
            expected: expected === undefined
                ? "undef"
                : `0x${expected.toString(16).padStart(2, "0")}`,
            actual: actual === undefined
                ? "undef"
                : `0x${actual.toString(16).padStart(2, "0")}`,
        });
    }
}
export function assertExists(name, value) {
    if (value === undefined || value === null) {
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

export function assertArrayEqual(message, actual, expected) {

    const actualIsArray   = Array.isArray(actual);
    const expectedIsArray = Array.isArray(expected);

    if (!actualIsArray || !expectedIsArray) {
        throw new Error(
            `FAIL: ${message}\n` +
            `Array assertion failed\n` +
            `Expected type: array, got: ${typeof expected}\n` +
            `Actual type:   array, got: ${typeof actual}\n\n` +
            `Expected value:\n${pretty(expected)}\n\n` +
            `Actual value:\n${pretty(actual)}`
        );
    }

    if (actual.length !== expected.length) {
        throw new Error(
            `FAIL: ${message}\n` +
            `Array length mismatch\n` +
            `Expected length: ${expected.length}\n` +
            `Actual length:   ${actual.length}\n\n` +
            `Expected:\n${pretty(expected)}\n\n` +
            `Actual:\n${pretty(actual)}`
        );
    }

    for (let i = 0; i < actual.length; i++) {
        assertEqual(
            `${message}[${i}]`,
            actual[i],
            expected[i]
        );
    }
}

export function assertIsBoxType(label, bytes, fourcc) {
    assertEqual(
        `${label}.type`,
        readFourCC(bytes, 4),
        fourcc
    );
}

export function assertThrows(name, fn) {
    let threw = false;

    try {
        fn();
    } catch (err) {
        threw = true;
    }

    if (!threw) {
        throw new Error(
            `FAIL: ${name}\n` +
            `Expected function to throw, but it did not`
        );
    }
}

export function assertNotExists(name, value) {
    if (value !== undefined && value !== null) {
        throw new Error(
            `FAIL: ${name} should not exist\n` +
            `Actual: ${JSON.stringify(value)}`
        );
    }
}

export function assertObjectEqual(message, actual, expected) {
    assertEqual(message, actual, expected);
}

function pretty(value) {
    if (typeof value === "string") {
        return `"${value}"`;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (value === null) {
        return "null";
    }

    if (value === undefined) {
        return "undefined";
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function deepEqual(a, b) {

    if (a === b) {
        return true;
    }

    if (typeof a !== typeof b) {
        return false;
    }

    if (a === null || b === null) {
        return a === b;
    }

    if (typeof a !== "object") {
        return false;
    }

    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) {
            return false;
        }

        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) {
                return false;
            }
        }

        return true;
    }

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length) {
        return false;
    }

    for (const key of aKeys) {
        if (!deepEqual(a[key], b[key])) {
            return false;
        }
    }

    return true;
}
