/**
 * INSPECTION TEST — Box Tree Diff (AV vs Visual)
 *
 * Purpose:
 *   - Identify MP4 boxes introduced by audio tracks
 *
 * This test:
 *   - diffs reference_visual.mp4 against reference_av.mp4
 *   - reports added box paths
 *   - performs no semantic interpretation
 *
 * Output answers:
 *   “What boxes must the compiler learn next?”
 */
import { asIsoBoxContainer } from "../../box-model/Box.js";

import {
    extractBoxByPathFromMp4,
    extractVideoStsd
} from "../reference/BoxExtractor.js";

import { logStsdDiff } from "./debug/logStsdDiff.js";

function collectBoxPaths(bytes, prefix = "") {
    const container = asIsoBoxContainer(bytes);
    const children = container.enumerateChildren();

    const paths = [];

    for (const child of children) {
        const path = prefix ? `${prefix}/${child.type}` : child.type;
        paths.push(path);

        const childBytes = bytes.slice(
            child.offset,
            child.offset + child.size
        );

        // Recurse only if container
        try {
            asIsoBoxContainer(childBytes);
            paths.push(...collectBoxPaths(childBytes, path));
        } catch {
            // leaf box, stop
        }
    }

    return paths;
}

export async function inspectBoxTreeDiff_AV_vs_Visual() {
    const visResp = await fetch("reference/reference_visual.mp4");
    const avResp  = await fetch("reference/reference_av.mp4");

    const visBytes = new Uint8Array(await visResp.arrayBuffer());
    const avBytes  = new Uint8Array(await avResp.arrayBuffer());

    const visPaths = new Set(collectBoxPaths(visBytes));
    const avPaths  = new Set(collectBoxPaths(avBytes));

    const added = [...avPaths].filter(p => !visPaths.has(p));
    const removed = [...visPaths].filter(p => !avPaths.has(p));

    console.log("=== BOX TREE DIFF (AV vs VISUAL) ===");

    for (const p of added) {
        console.log("+", p);
    }

    for (const p of removed) {
        console.log("-", p);
    }

    console.log("=== END DIFF ===");

    const visualStsd = extractVideoStsd(visBytes);
    const audioStsd  = extractVideoStsd(avBytes);

    if (visualStsd && audioStsd) {
        logStsdDiff({
            leftLabel: "VISUAL",
            rightLabel: "AV",
            leftRaw: visualStsd,
            rightRaw: audioStsd
        });
    }

}
