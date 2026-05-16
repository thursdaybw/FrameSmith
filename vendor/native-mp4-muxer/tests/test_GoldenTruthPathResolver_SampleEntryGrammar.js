import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function test_PathResolver_rejects_internal_pipe_grammar_in_input() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let error;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd|avc1"
        );
    } catch (e) {
        error = e;
    }

    if (!error) {
        throw new Error(
            "Expected error when '|' appears in input path"
        );
    }

    if (!error.message.includes("SampleEntries must be addressed")) {
        throw new Error(
            "Error message must explain SampleEntry selector rules.\n\n" +
            error.message
        );
    }
}

