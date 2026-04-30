import { getBoxSchemaForPath } from "../box-schema/boxSchemas.js";
import { HEADER_LAYOUTS } from "../box-schema/headerLayouts.js";
import { PRIMITIVE_SIZES } from "../box-schema/primitiveLayouts.js";

/**
 * Container Box Model
 * ===================
 *
 * Purpose
 * -------
 * This module defines the *authoritative traversal semantics* for MP4
 * container boxes.
 *
 * In ISO Base Media File Format (MP4), many boxes exist solely to *contain*
 * other boxes. However, not all container boxes share the same binary
 * header layout. As a result, the byte offset at which child boxes begin
 * is *not uniform* across all containers.
 *
 * This module makes that distinction:
 *   - explicit
 *   - centralized
 *   - and non-optional
 *
 *
 * The Architectural Problem
 * -------------------------
 * A naive MP4 parser often assumes that child boxes always begin immediately
 * after the standard 8-byte box header:
 *
 *   size (4 bytes)
 *   type (4 bytes)
 *
 * This assumption is false.
 *
 * Some MP4 containers — known as *FullBoxes* — include additional header
 * fields:
 *
 *   version (1 byte)
 *   flags   (3 bytes)
 *
 * These fields shift the starting offset of child boxes from 8 bytes to
 * 12 bytes.
 *
 * Any traversal code that:
 *   - hardcodes offsets
 *   - switches on box type names
 *   - or embeds MP4 header knowledge implicitly
 *
 * becomes brittle, tightly coupled, and prone to subtle traversal bugs.
 *
 * These bugs often surface only when encountering less common structures,
 * such as:
 *   - `meta` inside `udta`
 *   - nested metadata containers
 *   - or editor-produced MP4 variants
 *
 *
 * Design Principle
 * ----------------
 * Traversal semantics belong to the *container*, not the caller.
 *
 * Callers must not:
 *   - compute child offsets
 *   - infer header layouts
 *   - branch on box type strings
 *
 * Instead, callers declare intent:
 *
 *   “Treat these bytes as a container, and enumerate its children.”
 *
 * The container model then selects the correct traversal strategy.
 *
 *
 * Public API
 * ----------
 *   asIsoBoxContainer({ type, bytes })
 *
 * This is the *only* supported way to traverse child boxes.
 *
 * The returned object exposes:
 *   - enumerateChildren()
 *
 * Callers never need to know:
 *   - whether the box is a SimpleBox or FullBox
 *   - how many header bytes precede the payload
 *   - or where child traversal begins
 *
 *
 * Design Patterns in Use
 * ---------------------
 * - Factory Function
 *   `asIsoBoxContainer` binds raw bytes to traversal behavior without
 *   inheritance or class hierarchies.
 *
 * - Strategy Pattern
 *   All containers share the same traversal algorithm.
 *   The *starting offset* is the varying strategy.
 *
 * - Tell, Don’t Ask
 *   Callers do not ask what kind of container this is.
 *   They ask the container to enumerate its children.
 *
 * - Information Hiding
 *   FullBox vs SimpleBox detection is centralized and private.
 *   No other module needs to know how this decision is made.
 *
 * - Make Illegal States Unrepresentable
 *   There is no public API that allows child traversal without first
 *   passing through the container abstraction.
 *
 *
 * Result
 * ------
 * All MP4 box traversal is now:
 *   - explicit in intent
 *   - local in responsibility
 *   - spec-aligned
 *   - and robust to structural variation
 *
 * This abstraction exists to preserve architectural integrity as the
 * MP4 box tree grows in depth, nesting, and semantic complexity.
 */

/**
 * Public API
 * ----------
 * Returns a container abstraction that knows how
 * to enumerate its children correctly.
 */
export function asIsoBoxContainer(bytes, path) {

    if (!(bytes instanceof Uint8Array)) {
        throw new Error(
            "asIsoBoxContainer: expected Uint8Array, received " +
            Object.prototype.toString.call(bytes)
        );
    }

    if (bytes.length < 8) {
        throw new Error("asIsoBoxContainer: invalid byte buffer");
    }

    if (typeof path !== "string" || path.length === 0) {
        throw new Error(
            "asIsoBoxContainer: path must be a non-empty string"
        );
    }

    // ------------------------------------------------------------
    // File-level container (explicit schema root)
    // ------------------------------------------------------------
    if (path === "$mp4") {
        return makeContainer({
            bytes,
            childOffset: 0,
            type: null
        });
    }

    const schema = getBoxSchemaForPath(path);

    if (schema.structuralRole !== "container") {
        throw new Error(
            `asIsoBoxContainer: '${path}' is not a container per schema`
        );
    }

    const headerLayout = HEADER_LAYOUTS[schema.headerLayout];

    if (!headerLayout) {
        throw new Error(
            `asIsoBoxContainer: unknown headerLayout '${schema.headerLayout}' for '${path}'`
        );
    }

    // ------------------------------------------------------------
    // Compute child offset (header + declared fields)
    // ------------------------------------------------------------
    let childOffset = headerLayout.headerSize;

    if (schema.fields) {
        for (const fieldType of Object.values(schema.fields)) {

            // Variable-length / opaque fields do not contribute
            // to static child offsets
            if (fieldType.endsWith("[]")) {
                break;
            }

            const size = PRIMITIVE_SIZES[fieldType];

            if (!size) {
                throw new Error(
                    `asIsoBoxContainer: unknown fixed-size primitive '${fieldType}' in '${path}'`
                );
            }

            childOffset += size;
        }
    }

    return makeContainer({
        bytes,
        childOffset,
        type: null
    });

}


/**
 * Binds raw bytes to traversal behavior.
 *
 * This function creates the *container abstraction* returned by asIsoBoxContainer.
 *
 * Responsibilities:
 * - capture the correct child offset
 * - expose a single traversal operation
 *
 * Non-responsibilities:
 * - decoding box contents
 * - interpreting semantics
 * - exposing header layout details
 *
 * Architectural note:
 * This function deliberately returns a minimal surface area.
 * The container exists only to answer one question:
 *
 *   “What are my immediate children?”
 */
function makeContainer({ bytes, childOffset, type }) {
    return {
        type,
        enumerateChildren() {
            return enumerateChildrenFromOffset(bytes, childOffset);
        }
    };
}

/**
 * Enumerates immediate child boxes starting at a known offset.
 *
 * This is a low-level structural traversal routine.
 *
 * Responsibilities:
 * - walk sequential MP4 box headers
 * - extract type, size, and byte offset
 *
 * Non-responsibilities:
 * - decoding box payloads
 * - validating semantic correctness
 * - enforcing ordering rules
 *
 * Termination conditions:
 * - size === 0 (end of box list)
 * - size exceeds parent bounds
 *
 * This function is intentionally private.
 * All callers must pass through the container abstraction.
 */
function enumerateChildrenFromOffset(bytes, offset) {
    const children = [];
    let cursor = offset;

    while (cursor + 8 <= bytes.length) {

        const size =
            (bytes[cursor]     << 24) |
            (bytes[cursor + 1] << 16) |
            (bytes[cursor + 2] << 8)  |
            bytes[cursor + 3];

        if (size === 0) break;
        if (cursor + size > bytes.length) break;

        const type = String.fromCharCode(
            bytes[cursor + 4],
            bytes[cursor + 5],
            bytes[cursor + 6],
            bytes[cursor + 7]
        );

        children.push({
            type,
            size,
            offset: cursor
        });

        cursor += size;
    }

    return children;
}

