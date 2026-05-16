import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

export async function inspectUdtaAcrossTracks() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4",
    ];

    for (const fixture of fixtures) {

        const resp = await fetch(fixture);
        const mp4  = new Uint8Array(await resp.arrayBuffer());

        console.log(`=== UDTA TRACK PROBE (${fixture}) ===`);

        // Hard upper bound to avoid infinite probing
        for (let i = 0; i < 2; i++) {

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
            // 2. Probe UDTA
            // -------------------------------------------------
            try {
                const udta =
                    getGoldenTruthBox
                        .getSemanticBoxDataByPathFromMp4File(mp4, `${trakPath}/udta`)
                        .readBoxReport();

                console.log(
                    `  ✔ UDTA present (size = ${udta.box.size})`
                );

                // -------------------------------------------------
                // 3. Enumerate UDTA children (if any)
                // -------------------------------------------------
                const children = udta.box.children || [];

                if (children.length === 0) {
                    console.log(`    (udta has no child boxes)`);
                } else {
                    for (const child of children) {
                        console.log(
                            `    └─ ${child.type} (size = ${child.size})`
                        );
                    }
                }

            } catch (err) {
                console.log(`  ✘ UDTA absent`, err);
            }
        }

        console.log(`=== END UDTA TRACK PROBE (${fixture}) ===`);
        console.log("");
    }
}
