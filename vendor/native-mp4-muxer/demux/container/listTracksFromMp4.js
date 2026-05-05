import { getGoldenTruthBox } from "../../tests/goldenTruthExtractors/index.js";

export function listTracksFromMp4({ mp4Bytes }) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("listTracksFromMp4: mp4Bytes must be Uint8Array");
    }

    const tracks = [];
    let index = 0;

    while (true) {

        const result = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    `moov/trak[${index}]`
                );

        // Expected termination condition: no more tracks
        if (result && result.found === false) {
            break;
        }

        // Found a track; ensure it is readable
        if (!result || typeof result.readBoxReport !== "function") {
            throw new Error(
                `listTracksFromMp4: invalid trak[${index}] result shape`
            );
        }

        result.readBoxReport();

        tracks.push({ zeroBasedTrackIndex: index });
        index += 1;
    }

    return tracks;
}
