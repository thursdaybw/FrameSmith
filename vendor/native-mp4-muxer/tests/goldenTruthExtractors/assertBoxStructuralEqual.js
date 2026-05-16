import { assertArrayEqual, assertEqual } from "../assertions.js";
import { getBoxSchemaForPath } from "../../box-schema/boxSchemas.js";

/**
 * Assert that two box projections are structurally identical.
 *
 * Schema-driven comparison.
 * NO inference.
 */
export function assertBoxStructuralEqual(
    label,
    actual,
    expected,
    path,
) {

    // ---------------------------------------------------------
    // Guard: label
    // ---------------------------------------------------------
    if (label === undefined) {
        throw new Error(
            "assertBoxStructuralEqual: label is required"
        );
    }

    if (typeof label !== "string") {
        throw new Error(
            `assertBoxStructuralEqual: label must be a string, got ${typeof label}`
        );
    }

    // ---------------------------------------------------------
    // Guard: path
    // ---------------------------------------------------------
    if (path === undefined) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): path is required`
        );
    }

    if (typeof path !== "string") {
        throw new Error(
            `assertBoxStructuralEqual(${label}): path must be a string, got ${typeof path}`
        );
    }

    if (path.length === 0) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): path must not be empty`
        );
    }

    // ---------------------------------------------------------
    // Guard: actual / expected
    // ---------------------------------------------------------
    if (actual === undefined) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): missing argument 'actual'`
        );
    }

    if (expected === undefined) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): missing argument 'expected'`
        );
    }

    if (typeof actual !== "object" || actual === null) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): argument 'actual' must be an object, got ${actual === null ? "null" : typeof actual}`
        );
    }

    if (typeof expected !== "object" || expected === null) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): argument 'expected' must be an object, got ${expected === null ? "null" : typeof expected}`
        );
    }

    // ---------------------------------------------------------
    // Guard: schema
    // ---------------------------------------------------------
    const schema = getBoxSchemaForPath(path);

    if (!schema) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): no schema registered for '${path}'`
        );
    }

    // ---------------------------------------------------------
    // Guard: type
    // ---------------------------------------------------------
    if (!("type" in actual)) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): actual.type is required for '${path}'`
        );
    }

    if (!("type" in expected)) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): expected.type is required for '${path}'`
        );
    }

    if (typeof actual.type !== "string") {
        throw new Error(
            `assertBoxStructuralEqual(${label}): actual.type must be a string, got ${typeof actual.type}`
        );
    }

    if (typeof expected.type !== "string") {
        throw new Error(
            `assertBoxStructuralEqual(${label}): expected.type must be a string, got ${typeof expected.type}`
        );
    }

    // ---------------------------------------------------------
    // Type
    // ---------------------------------------------------------
    assertEqual(`${path}.type`, actual.type, expected.type);

    // ---------------------------------------------------------
    // Fields
    // ---------------------------------------------------------
    const actualFields =
        actual.fields === undefined
        ? {}
        : actual.fields;

    const expectedFields =
        expected.fields === undefined
        ? {}
        : expected.fields;

    if (typeof actualFields !== "object" || actualFields === null) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): actual.fields must be an object, got ${actualFields === null ? "null" : typeof actualFields}`
        );
    }

    if (typeof expectedFields !== "object" || expectedFields === null) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): expected.fields must be an object, got ${expectedFields === null ? "null" : typeof expectedFields}`
        );
    }

    const actualFieldKeys = Object.keys(actualFields).sort();
    const expectedFieldKeys = Object.keys(expectedFields).sort();

    assertEqual(
        `${path}.fields keys`,
        JSON.stringify(actualFieldKeys),
        JSON.stringify(expectedFieldKeys)
    );

    for (const key of expectedFieldKeys) {
        const actualValue   = actualFields[key];
        const expectedValue = expectedFields[key];

        if (Array.isArray(expectedValue)) {
            assertArrayEqual(
                `${path}.fields.${key}`,
                actualValue,
                expectedValue
            );
        } else {
            assertEqual(
                `${path}.fields.${key}`,
                actualValue,
                expectedValue
            );
        }
    }

    // ---------------------------------------------------------
    // Children
    // ---------------------------------------------------------
    const containerModel = schema.containerModel || "map";

    // Table container (stsd)
    if (containerModel === "table") {
        return;
    }

    const actualChildren =
        actual.children === undefined
        ? {}
        : actual.children;

    const expectedChildren =
        expected.children === undefined
        ? {}
        : expected.children;

    if (typeof actualChildren !== "object" || actualChildren === null) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): actual.children must be an object, got ${actualChildren === null ? "null" : typeof actualChildren}`
        );
    }

    if (typeof expectedChildren !== "object" || expectedChildren === null) {
        throw new Error(
            `assertBoxStructuralEqual(${label}): expected.children must be an object, got ${expectedChildren === null ? "null" : typeof expectedChildren}`
        );
    }

    const actualChildKeys = Object.keys(actualChildren).sort();
    const expectedChildKeys = Object.keys(expectedChildren).sort();

    assertEqual(
        `${path}.children keys`,
        JSON.stringify(actualChildKeys),
        JSON.stringify(expectedChildKeys)
    );

    for (const type of expectedChildKeys) {

        if (typeof type !== "string") {
            throw new Error(
                `assertBoxStructuralEqual(${label}): child key must be a string, got ${typeof type}`
            );
        }

        const childPath = `${path}/${type}`;

        assertBoxStructuralEqual(
            label,
            actualChildren[type],
            expectedChildren[type],
            childPath
        );
    }
}
