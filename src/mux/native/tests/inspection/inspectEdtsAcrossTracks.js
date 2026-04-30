
import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

export async function inspectEdtsAcrossTracks() {

    //const resp = await fetch("reference/reference_av.mp4");
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    console.log("=== EDTS / ELST TRACK PROBE ===");

    // Hard upper bound to avoid infinite probing
    for (let i = 0; i < 8; i++) {

        const trakPath = `moov/trak[${i}]`;

        // -------------------------------------------------
        // 1. Resolve handler (context)
        // -------------------------------------------------
        let handlerType = null;

        try {
            const hdlr =
                getGoldenTruthBox
                    .getSemanticBoxDataByPathFromMp4File(mp4, `${trakPath}/mdia/hdlr`)
                    .readBoxReport();

            handlerType = hdlr.box.fields.handlerType;

            console.log(
                `trak[${i}] handler = ${handlerType}`
            );

        } catch (err) {
            console.log(
                `trak[${i}] <no mdia/hdlr — skipping>`, err
            );
            continue;
        }

        // -------------------------------------------------
        // 2. Probe EDTS
        // -------------------------------------------------
        try {
            const edts =
                getGoldenTruthBox
                    .getSemanticBoxDataByPathFromMp4File(mp4, `${trakPath}/edts`)
                    .readBoxReport();

            console.log(`  ✔ EDTS present`);

            // ---------------------------------------------
            // 3. Probe ELST
            // ---------------------------------------------
            try {
                const elst =
                    getGoldenTruthBox
                        .getSemanticBoxDataByPathFromMp4File(mp4, `${trakPath}/edts/elst`)
                        .readBoxReport();

                const { version, entryCount } = elst.box.fields;

                console.log(
                    `    ✔ ELST present (version=${version}, entryCount=${entryCount})`
                );

            } catch (err) {
                console.log(`    ✘ ELST missing (INVALID MP4)`, err);
            }

        } catch (err) {
            console.log(`  ✘ EDTS absent`, err);
        }
    }

    console.log("=== END EDTS / ELST TRACK PROBE ===");
}
