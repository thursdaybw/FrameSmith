import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

export async function inspectCttsAcrossTracks() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    console.log("=== CTTS TRACK PROBE ===");

    // Hard upper bound to avoid infinite probing
    for (let i = 0; i < 8; i++) {

        const trakPath = `moov/trak[${i}]`;

        // -------------------------------------------------
        // 1. Resolve handler
        // -------------------------------------------------
        let handlerType = null;

        try {
            const hdlr =
                getGoldenTruthBox
                    .fromMp4(mp4, `${trakPath}/mdia/hdlr`)
                    .readBoxReport();

            handlerType = hdlr.box.fields.handlerType;

            console.log(
                `trak[${i}] handler = ${handlerType}`
            );

        } catch {
            console.log(
                `trak[${i}] handler = <none>`
            );
            continue;
        }

        // -------------------------------------------------
        // 2. Attempt CTTS resolution
        // -------------------------------------------------
        try {
            const ctts =
                getGoldenTruthBox
                    .fromMp4(
                        mp4,
                        `${trakPath}/mdia/minf/stbl/ctts`
                    )
                    .readBoxReport();

            console.log(
                `  ✔ CTTS present (entryCount = ${ctts.box.fields.entryCount})`
            );

        } catch (err) {
            console.log(
                `  ✘ CTTS absent`
            );
        }
    }

    console.log("=== END CTTS TRACK PROBE ===");
}
