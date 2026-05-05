/**
 * STSD — Sample Description Box
 * =============================
 *
 * Generic STSD emitter.
 *
 * This emitter is codec-agnostic.
 * It emits whatever SampleEntry nodes it is given, verbatim and in order.
 *
 * Contract:
 *   emitStsdBox({
 *     sampleEntries: Array<SampleEntryNode>
 *   })
 *
 * Responsibilities:
 *   - set version = 0
 *   - set flags   = 0
 *   - emit entry_count
 *   - attach SampleEntry children as-is
 *
 * It does NOT:
 *   - inspect SampleEntry internals
 *   - infer codecs
 *   - special-case avc1 or mp4a
 */
export function emitStsdBox({ sampleEntryCount, sampleEntries }) {
    return {
        type: "stsd",
        version: 0,
        flags: 0,
        body: [
            { int: sampleEntryCount }
        ],
        children: sampleEntries
    };
}


export function registerStsdEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/stsd",
        emitStsdBox
    );
}
