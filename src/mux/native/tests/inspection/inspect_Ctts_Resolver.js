/**
 * INSPECTION TEST — CTTS Resolver Resolution
 *
 * Purpose:
 * --------
 * Inspect how GoldenTruthPathResolver resolves the path:
 *
 *   moov/trak[0]/mdia/minf/stbl/ctts
 *
 * across:
 *   - reference_visual.mp4
 *   - reference_av.mp4
 *
 * This test:
 *   - does NOT assert correctness
 *   - does NOT enforce schema
 *   - does NOT require extractors to exist
 *
 * It only reports:
 *   - whether resolution succeeds
 *   - what error occurs if it fails
 */

import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

async function inspectResolve(label, mp4Bytes) {

    console.group(`CTTS RESOLUTION — ${label}`);

    try {
        const box =
            getGoldenTruthBox.fromMp4(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/stbl/ctts"
            );

        const report = box.readBoxReport();

        console.log("✔ resolved");
        console.log("raw length:", report.raw.length);
        console.log("entryCount:", report.box.fields.entryCount);

    } catch (err) {
        console.log("✘ resolution failed");
        console.log("error:", err.message);
    }

    console.groupEnd();
}

export async function inspectCttsResolver() {

    const visResp = await fetch("reference/reference_visual.mp4");
    const avResp  = await fetch("reference/reference_av.mp4");

    const visBytes = new Uint8Array(await visResp.arrayBuffer());
    const avBytes  = new Uint8Array(await avResp.arrayBuffer());

    await inspectResolve("VISUAL", visBytes);
    await inspectResolve("AV", avBytes);
}
