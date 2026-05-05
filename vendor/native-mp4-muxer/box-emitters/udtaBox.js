/**
 * udta — User Data Box
 * -------------------
 *
 * Opaque container.
 *
 * Contents are preserved byte-for-byte but not interpreted.
 * This box participates fully in layout and size calculations.
 */
function emitUdtaBox({ children }) {
    if (!Array.isArray(children)) {
        throw new Error("emitUdtaBox: children must be an array");
    }

    return {
        type: "udta",
        children
    };
}
export function registerUdtaEmitter(registry) {
    registry.registerEmitter(
        "moov/udta",
        emitUdtaBox
    );
}
