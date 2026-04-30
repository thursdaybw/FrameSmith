/**
 * MP4 Serializer DSL — Structural Specification
 * =============================================
 *
 * This file defines a **strict domain-specific language (DSL)** for describing
 * MP4 box layouts declaratively.
 *
 * The serializer is NOT a permissive writer.
 * It is a **validating compiler** for MP4 container structure.
 *
 * Its job is to:
 *   - translate a JSON box tree into bytes
 *   - enforce structural invariants
 *   - fail fast on ambiguous or lossy layouts
 *
 * If this file accepts a structure, it MUST serialize to a
 * deterministic, player-compatible MP4 representation.
 *
 * ---------------------------------------------------------------------------
 * WHY A DSL EXISTS AT ALL
 * ---------------------------------------------------------------------------
 *
 * MP4 is a **binary container format**, not a general data structure.
 *
 * In MP4:
 *   - field widths are fixed
 *   - ordering is meaningful
 *   - hierarchy is not negotiable
 *
 * JavaScript objects are flexible.
 * MP4 is not.
 *
 * This DSL exists to close that gap and prevent:
 *   - silent structure loss
 *   - ambiguous nesting
 *   - boxes disappearing during serialization
 *   - “it sort of worked” output that fails in players
 *
 * Builders MUST conform to this DSL.
 * The serializer will not guess your intent.
 *
 * ---------------------------------------------------------------------------
 * BOX NODE
 * ---------------------------------------------------------------------------
 *
 * A box node represents exactly one MP4 box.
 *
 * A valid box node MUST have:
 *
 *   {
 *     type: "abcd",            // required, FourCC, length === 4
 *     version?: number,        // optional, u8
 *     flags?: number|object,   // optional
 *     flagBits?: object,       // required if flags is an object
 *     body?: Field[],          // optional
 *     children?: BoxNode[]     // optional
 *   }
 *
 * Notes:
 * - `type` is the MP4 FourCC, not a JavaScript type
 * - `version` and `flags` implement the ISO FullBox pattern
 * - `body` describes the box’s internal fields
 * - `children` describes nested boxes that follow the body
 *
 * ---------------------------------------------------------------------------
 * BODY FIELD VOCABULARY
 * ---------------------------------------------------------------------------
 *
 * A box body is an ordered array of **fields**.
 *
 * Each field MUST be one of the following shapes:
 *
 *   { int: number }            // u32, big-endian
 *   { short: number }          // u16, big-endian
 *   { byte: number }           // u8
 *   { OpaqueBytesPassthroug: Uint8Array }      // raw byte copy (verbatim)
 *
 *   { array: "byte"|"short"|"int", values: number[] }
 *
 *   { type: "abcd" }           // literal FourCC inside body
 *
 *   { box: BoxNode }           // nested box embedded *inline* in body
 *
 * Nothing else is allowed.
 *
 * This vocabulary is intentionally small.
 * If something is not representable here, the DSL must be extended explicitly.
 * 
 * ---------------------------------------------------------------------------
 * RAW BYTES vs BYTE ARRAYS (CRITICAL DISTINCTION)
 * ---------------------------------------------------------------------------
 *
 * This DSL deliberately distinguishes between two different kinds of binary
 * data commonly found in MP4 files:
 *
 *   1. Serializer-owned binary fields
 *   2. Serializer-opaque passthrough payloads
 *
 * These are NOT interchangeable.
 *
 *
 * 1. Serializer-owned binary fields
 * ---------------------------------
 *
 * Use:
 *
 *   { array: "byte", values: number[] }
 *
 * When:
 *   - the bytes are part of a box’s defined structure
 *   - the serializer is responsible for emitting them
 *   - the bytes are small, bounded, and positionally defined
 *
 * Examples:
 *   - avcC payloads (SPS / PPS)
 *   - codec configuration records
 *   - metadata values (e.g. ilst > data)
 *
 * These bytes may be semantically opaque to the builder, but they are
 * structurally owned by the MP4 container.
 *
 * The serializer writes them intentionally, byte-by-byte.
 *
 *
 * 2. Serializer-opaque passthrough payloads
 * -----------------------------------------
 *
 * Use:
 *
 *   { OpaqueBytesPassthrough: Uint8Array }
 *
 * ONLY when:
 *   - the payload is not structurally owned by the MP4 container
 *   - the serializer must not conceptually touch or reinterpret it
 *   - size and content are governed by external policy
 *
 * Example:
 *   - mdat media samples
 *
 * For this reason, raw byte passthrough is intentionally restricted to
 * `mdat` boxes only.
 *
 *
 * Design Rule:
 * ------------
 *
 * If the serializer is responsible for emitting the bytes,
 * use `{ array: "byte" }`.
 *
 * If the serializer must not reason about the bytes at all,
 * use `{ OpaqueBytesPassthrough }`, and only in `mdat`.
 *
 * This distinction is enforced by validation and is not optional.
 *
 * ---------------------------------------------------------------------------
 * BODY vs CHILDREN (CRITICAL DISTINCTION)
 * ---------------------------------------------------------------------------
 *
 * MP4 distinguishes between:
 *
 *   1. fields that appear *inside* a box
 *   2. boxes that appear *after* the box body
 *
 * This DSL mirrors that distinction exactly.
 *
 * BODY:
 * -----
 * Use `body` for:
 *   - scalar fields
 *   - arrays
 *   - raw bytes
 *   - boxes that are embedded inline as part of the body layout
 *
 * Inline boxes MUST be wrapped:
 *
 *   { box: someBoxNode }
 *
 * CHILDREN:
 * ----------
 * Use `children` for:
 *   - boxes that follow the body
 *   - true container hierarchies
 *
 * Children MUST be raw box nodes:
 *
 *   children: [ boxNodeA, boxNodeB ]
 *
 * Wrappers are NOT allowed in `children`.
 *
 * ---------------------------------------------------------------------------
 * INVALID STRUCTURES (REJECTED BY DESIGN)
 * ---------------------------------------------------------------------------
 *
 * ❌ Raw box node placed directly in body:
 *
 *     body: [
 *       { int: 1 },
 *       { type: "avc1", body: [...] }
 *     ]
 *
 * This is ambiguous and causes silent serialization loss.
 *
 * ✅ Correct:
 *
 *     body: [
 *       { int: 1 },
 *       { box: { type: "avc1", body: [...] } }
 *     ]
 *
 * ---------------------------------------------------------------------------
 * VALIDATION PHILOSOPHY
 * ---------------------------------------------------------------------------
 *
 * The serializer validates BEFORE writing bytes.
 *
 * It will throw if:
 *   - a raw box node appears in `body`
 *   - a wrapped box appears in `children`
 *   - a field shape is not part of the DSL
 *   - flags are invalid or underspecified
 *
 * This is intentional.
 *
 * Failing early with a precise error is preferable to:
 *   - corrupted MP4 output
 *   - non-discoverable sample entries
 *   - hours of downstream debugging
 *
 * ---------------------------------------------------------------------------
 * DESIGN INTENT
 * ---------------------------------------------------------------------------
 *
 * - Builders MUST adapt to this DSL
 * - Tests serve as executable documentation
 * - No silent coercion
 * - No implicit structure
 *
 * If a structure passes this serializer,
 * it is safe to assume a player can walk it.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeByte(buf, offset, value) {
    buf[offset] = value & 0xFF;
}

function writeShort(buf, offset, value) {
    buf[offset]     = (value >>> 8) & 0xFF;
    buf[offset + 1] = value & 0xFF;
}

function writeInt(buf, offset, value) {
    buf[offset]     = (value >>> 24) & 0xFF;
    buf[offset + 1] = (value >>> 16) & 0xFF;
    buf[offset + 2] = (value >>> 8)  & 0xFF;
    buf[offset + 3] = value & 0xFF;
}

function writeUint64(buf, offset, value) {
    const v = BigInt(value);
    if (v < 0n || v > 0xFFFF_FFFF_FFFF_FFFFn) {
        throw new Error(`uint64 out of range: ${value}`);
    }
    const hi = Number((v >> 32n) & 0xFFFF_FFFFn);
    const lo = Number(v & 0xFFFF_FFFFn);
    writeInt(buf, offset, hi);
    writeInt(buf, offset + 4, lo);
}

function writeInt64(buf, offset, value) {
    const v = BigInt(value);
    if (v < -0x8000_0000_0000_0000n || v > 0x7FFF_FFFF_FFFF_FFFFn) {
        throw new Error(`int64 out of range: ${value}`);
    }
    const twos = v < 0n ? (1n << 64n) + v : v;
    const hi = Number((twos >> 32n) & 0xFFFF_FFFFn);
    const lo = Number(twos & 0xFFFF_FFFFn);
    writeInt(buf, offset, hi);
    writeInt(buf, offset + 4, lo);
}

function normalizeFlags(node) {
    const { flags, flagBits, type } = node;

    if (flags === undefined) {
        return 0;
    }

    if (typeof flags === "number") {

        // ---------------------------------------------------------
        // Explicit opt-in: opaque codec-owned flags
        // ---------------------------------------------------------
        if (node.opaqueFlags === true) {
            return flags & 0xFFFFFF;
        }

        // ---------------------------------------------------------
        // Default: only binary flags allowed
        // ---------------------------------------------------------
        if (flags === 0 || flags === 1) {
            return flags;
        }

        throw new Error(
            `Box ${type}: numeric flags must be 0 or 1. ` +
            `Use named flags or set opaqueFlags: true for codec-owned flags.`
        );
    }

    if (typeof flags === "object") {
        if (!flagBits) {
            throw new Error(
                `Box ${type}: flagBits must be provided when using named flags`
            );
        }

        let value = 0;

        for (const [name, enabled] of Object.entries(flags)) {
            if (typeof enabled !== "boolean") {
                throw new Error(
                    `Box ${type}: flag '${name}' must be boolean`
                );
            }

            if (!(name in flagBits)) {
                throw new Error(
                    `Box ${type}: unknown flag '${name}'`
                );
            }

            if (enabled) {
                value |= flagBits[name];
            }
        }

        return value;
    }

    throw new Error(`Box ${type}: invalid flags value`);
}

// ---------------------------------------------------------------------------
// Compute size of a single box node
//
// byte: u8
// short: u16
// int: u32
// ---------------------------------------------------------------------------

export function computeBoxSize(node) {

    // RAW BOX NODE (verbatim passthrough)
    if (node && node.bytes instanceof Uint8Array) {
        return node.bytes.length;
    }

    let size = 8; // size(4) + type(4)

    const hasVersionFlags = Object.prototype.hasOwnProperty.call(node, "version");
    if (hasVersionFlags) {
        size += 4; // version + flags
    }

    // Body fields
    for (const field of (node.body || [])) {

        if ("int" in field) size += 4;
        else if ("uint64" in field) size += 8;
        else if ("int64" in field) size += 8;
        else if ("short" in field) size += 2;
        else if ("byte" in field) size += 1;
        else if ("OpaqueBytesPassthrough" in field) {
            size += field.OpaqueBytesPassthrough.length;
        }

        else if ("array" in field) {
            const type = field.array;
            if (type === "int")   size += 4 * field.values.length;
            else if (type === "short") size += 2 * field.values.length;
            else if (type === "byte")  size += 1 * field.values.length;
            else if (type === "uint64") size += 8 * field.values.length;
            else if (type === "int64") size += 8 * field.values.length;
            else throw new Error("Unsupported array type: " + type);
        }

        else if ("box" in field) {
            size += computeBoxSize(field.box);
        }

        else if ("type" in field) {
            size += 4; // FourCC
        }

        else {
            throw new Error("Unsupported field in body: " + JSON.stringify(field));
        }
    }

    // Children
    for (const child of (node.children || [])) {
        size += computeBoxSize(child);
    }

    return size;
}

// ---------------------------------------------------------------------------
// Write a single box node's bytes
//
// byte: u8
// short: u16
// int: u32
// ---------------------------------------------------------------------------

export function writeBox(node, buffer, offset) {

    // RAW BOX NODE (verbatim passthrough)
    if (node && node.bytes instanceof Uint8Array) {
        buffer.set(node.bytes, offset);
        return offset + node.bytes.length;
    }

    const start = offset;
    const size = computeBoxSize(node);

    // Write size
    writeInt(buffer, offset, size);
    offset += 4;

    // Write type (FourCC)
    buffer[offset++] = node.type.charCodeAt(0);
    buffer[offset++] = node.type.charCodeAt(1);
    buffer[offset++] = node.type.charCodeAt(2);
    buffer[offset++] = node.type.charCodeAt(3);

    // version + flags
    const hasVersionFlags = Object.prototype.hasOwnProperty.call(node, "version");
    if (hasVersionFlags) {
        const version = node.version & 0xFF;
        const flags   = normalizeFlags(node) & 0xFFFFFF;

        writeByte(buffer, offset++, version);
        writeByte(buffer, offset++, (flags >>> 16) & 0xFF);
        writeByte(buffer, offset++, (flags >>> 8)  & 0xFF);
        writeByte(buffer, offset++, flags & 0xFF);
    }

    // Body
    for (const field of (node.body || [])) {

        if ("int" in field) {
            writeInt(buffer, offset, field.int);
            offset += 4;
        }

        else if ("uint64" in field) {
            writeUint64(buffer, offset, field.uint64);
            offset += 8;
        }

        else if ("int64" in field) {
            writeInt64(buffer, offset, field.int64);
            offset += 8;
        }

        else if ("short" in field) {
            writeShort(buffer, offset, field.short);
            offset += 2;
        }

        else if ("byte" in field) {
            writeByte(buffer, offset, field.byte);
            offset += 1;
        }

        else if ("OpaqueBytesPassthrough" in field) {
            const payload = field.OpaqueBytesPassthrough;
            buffer.set(payload, offset);
            offset += payload.length;
        }

        else if ("array" in field) {
            const type = field.array;
            const values = field.values;

            if (type === "int") {
                for (const v of values) {
                    writeInt(buffer, offset, v);
                    offset += 4;
                }
            } else if (type === "uint64") {
                for (const v of values) {
                    writeUint64(buffer, offset, v);
                    offset += 8;
                }
            } else if (type === "int64") {
                for (const v of values) {
                    writeInt64(buffer, offset, v);
                    offset += 8;
                }
            } else if (type === "short") {
                for (const v of values) {
                    writeShort(buffer, offset, v);
                    offset += 2;
                }
            } else if (type === "byte") {
                for (const v of values) {
                    writeByte(buffer, offset, v);
                    offset += 1;
                }
            } else {
                throw new Error("Unsupported array type: " + type);
            }
        }

        else if ("box" in field) {
            offset = writeBox(field.box, buffer, offset);
        }

        else if ("type" in field) {
            const t = field.type;
            buffer[offset++] = t.charCodeAt(0);
            buffer[offset++] = t.charCodeAt(1);
            buffer[offset++] = t.charCodeAt(2);
            buffer[offset++] = t.charCodeAt(3);
        }

        else {
            throw new Error("Unsupported field: " + JSON.stringify(field));
        }
    }

    // Children
    for (const child of (node.children || [])) {
        offset = writeBox(child, buffer, offset);
    }

    return start + size;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function serializeBoxTree(node) {
    validateBoxNode(node, "<root>");
    const size = computeBoxSize(node);
    const out = new Uint8Array(size);
    writeBox(node, out, 0);
    return out;
}

function validateBoxNode(node, path) {

    if (node === undefined) {
        throw new Error(`Box ${path} is undefined`);
    }

    if (node === null) {
        throw new Error(`Box ${path} is null`);
    }

    if (typeof node !== "object") {
        throw new Error(
            `Box ${path} must be an object, got ${typeof node}`
        );
    }

    if (typeof node.type !== "string" || node.type.length !== 4) {
        throw new Error(`Box at ${path} has invalid type`);
    }

    // ------------------------------------------------------------
    // RAW BOX NODE VALIDATION (box-level passthrough)
    // ------------------------------------------------------------

    const hasBytes = Object.prototype.hasOwnProperty.call(node, "bytes");

    if (hasBytes) {

        // Only udta may be represented as a raw box
        if (node.type !== "udta") {
            throw new Error(
                `Box ${path}: raw byte boxes are only allowed for 'udta', ` +
                `got '${node.type}'`
            );
        }

        // bytes must be Uint8Array
        if (!(node.bytes instanceof Uint8Array)) {
            throw new Error(
                `Box ${path}: 'bytes' must be a Uint8Array`
            );
        }

        // raw box must not mix representations
        if (node.body !== undefined || node.children !== undefined) {
            throw new Error(
                `Box ${path}: raw box must not define 'body' or 'children'`
            );
        }

        // raw box must be at least a valid MP4 box header
        if (node.bytes.length < 8) {
            throw new Error(
                `Box ${path}: raw box bytes too short to be a valid MP4 box`
            );
        }

        // raw box is fully validated; do not descend
        return;
    }

    // ------------------------------------------------------------
    // Validate body
    // ------------------------------------------------------------
    if (node.body !== undefined) {
        if (!Array.isArray(node.body)) {
            throw new Error(`Box ${path}: body must be an array`);
        }

        for (let i = 0; i < node.body.length; i++) {
            const field = node.body[i];

            if (field === undefined) {
                throw new Error(
                    `Box ${path}: body field at index ${i} is undefined`
                );
            }

            validateBodyField(field, `${path}[body:${i}]`, node.type);
        }

    }

    // ------------------------------------------------------------
    // Validate children
    // ------------------------------------------------------------
    if (node.children !== undefined) {
        if (!Array.isArray(node.children)) {
            throw new Error(`Box ${path}: children must be an array`);
        }

        for (const child of node.children) {

            // ❌ Wrapped boxes are forbidden in children
            if (child && typeof child === "object" && "box" in child) {
                throw new Error(
                    `Box ${path}: children must be raw box nodes, ` +
                    `not { box: node } wrappers`
                );
            }

            validateBoxNode(child, `${path}/${child.type}`);
        }
    }
}

function validateBodyField(field, path, boxType) {
    if (!field || typeof field !== "object") {
        throw new Error(`Box ${path}: invalid body field`);
    }

    // ❌ Raw bytes are forbidden except in mdat
    if ("OpaqueBytesPassthrough" in field && boxType !== "mdat") {
        throw new Error(
            `Box ${path}: OpaqueBytesPassthrough is only allowed in 'mdat' boxes`
        );
    }

    // ❌ Raw box node accidentally placed in body
    if (
        typeof field.type === "string" &&
        field.type.length === 4 &&
        ("body" in field || "children" in field)
    ) {
        throw new Error(
            `Box ${path}: raw box node '${field.type}' placed in body. ` +
            `Use { box: node } instead.`
        );
    }

    if ("box" in field) {
        validateBoxNode(field.box, `${path}/{box}`);
        return;
    }

    if (
        "int" in field ||
        "uint64" in field ||
        "int64" in field ||
        "short" in field ||
        "byte" in field ||
        "OpaqueBytesPassthrough" in field ||
        "array" in field ||
        ("type" in field && Object.keys(field).length === 1)
    ) {
        return;
    }

    throw new Error(
        `Box ${path}: unsupported body field ${JSON.stringify(field)}`
    );
}
