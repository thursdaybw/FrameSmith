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

function collectBoxPaths(bytes, path) {

    const container = asIsoBoxContainer(bytes, path);
    const children = container.enumerateChildren();

    const paths = [];

    for (const child of children) {

        const childPath = `${path}/${child.type}`;
        paths.push(childPath);

        const childBytes = bytes.slice(
            child.offset,
            child.offset + child.size
        );

        // Recurse only if child is a container
        try {
            collectBoxPaths(childBytes, childPath)
                .forEach(p => paths.push(p));
        } catch {
            // Leaf box, stop recursion
        }
    }

    return paths;
}

export async function inspectBoxTreeDiff_AV_vs_Visual() {

    const visResp = await fetch("reference/reference_visual.mp4");
    const avResp  = await fetch("reference/reference_av.mp4");

    const visBytes = new Uint8Array(await visResp.arrayBuffer());
    const avBytes  = new Uint8Array(await avResp.arrayBuffer());

    const visList = collectBoxPaths(visBytes, "$mp4");
    const avList  = collectBoxPaths(avBytes, "$mp4");

    summarizePaths("VISUAL", visList);
    summarizePaths("AV", avList);

    const visPaths = new Set(visList);
    const avPaths  = new Set(avList);

    const added   = [...avPaths].filter(p => !visPaths.has(p));
    const removed = [...visPaths].filter(p => !avPaths.has(p));

    console.log("=== BOX TREE DIFF (AV vs VISUAL) ===");

    for (const p of added) {
        console.log("+", p);
    }

    for (const p of removed) {
        console.log("-", p);
    }

    console.log("=== END DIFF ===");
}

function summarizePaths(label, paths) {
    const counts = {};

    for (const p of paths) {
        const fourcc = p.split("/").pop();
        counts[fourcc] = (counts[fourcc] || 0) + 1;
    }

    console.log(`--- ${label} SUMMARY ---`);
    console.log("total boxes:", paths.length);

    const sorted = Object.entries(counts)
        .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [fourcc, count] of sorted) {
        console.log(`${fourcc}: ${count}`);
    }

    console.log(`--- END ${label} SUMMARY ---`);
}
