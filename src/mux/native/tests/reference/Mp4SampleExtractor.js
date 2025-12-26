import { extractBoxByPathFromMp4 } from "./BoxExtractor.js";
import { readUint32 } from "../../bytes/mp4ByteReader.js";

export function extractVideoSamplesFromMp4({
    mp4Bytes,
    boxTree
}) {
    console.log("Mp4SampleExtractor: start");

    // ---- mdat ----------------------------------------------------
    const mdatBytes = extractBoxByPathFromMp4(mp4Bytes, "mdat");
    if (!mdatBytes) {
        throw new Error("Mp4SampleExtractor: mdat not found");
    }

    const mdatPayload = mdatBytes.slice(8);

    console.log(
        "Mp4SampleExtractor: mdat payload size =",
        mdatPayload.length
    );

    // ---- stsz ----------------------------------------------------
    const stszBytes = extractBoxByPathFromMp4(
        mp4Bytes,
        "moov/trak/mdia/minf/stbl/stsz"
    );

    if (!stszBytes) {
        throw new Error("Mp4SampleExtractor: stsz not found");
    }

    const sampleSize  = readUint32(stszBytes, 12);
    const sampleCount = readUint32(stszBytes, 16);

    console.log(
        "Mp4SampleExtractor: stsz.sample_size =",
        sampleSize
    );
    console.log(
        "Mp4SampleExtractor: stsz.sample_count =",
        sampleCount
    );

    // ---- read per-sample sizes -------------------------------------
    if (sampleSize !== 0) {
        throw new Error(
            "Mp4SampleExtractor: fixed-size stsz not supported for this oracle"
        );
    }

    const sizes = [];
    let sizeOffset = 20;

    for (let i = 0; i < sampleCount; i++) {
        sizes.push(readUint32(stszBytes, sizeOffset));
        sizeOffset += 4;
    }

    console.log(
        "Mp4SampleExtractor: first 5 sample sizes =",
        sizes.slice(0, 5)
    );

    // ---- slice mdat payload ----------------------------------------
    let cursor = 0;
    const samples = [];

    for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i];

        const bytes = mdatPayload.slice(cursor, cursor + size);

        samples.push({
            bytes,
            timestamp: 0,
            duration: 0,
            isKey: true,
            sampleDescriptionIndex: 1
        });

        cursor += size;
    }

    // ---- mdhd (timescale) ------------------------------------------
    const mdhdBytes = extractBoxByPathFromMp4(
        mp4Bytes,
        "moov/trak/mdia/mdhd"
    );

    if (!mdhdBytes) {
        throw new Error("Mp4SampleExtractor: mdhd not found");
    }

    // mdhd is FullBox
    // version is at byte 8
    const mdhdVersion = mdhdBytes[8];

    let timescale;

    if (mdhdVersion === 0) {
        // timescale at offset 20 for version 0
        timescale = readUint32(mdhdBytes, 20);
    } else {
        throw new Error(
            "Mp4SampleExtractor: mdhd version > 0 not supported for this oracle"
        );
    }

    console.log(
        "Mp4SampleExtractor: mdhd.timescale =",
        timescale
    );

    // ---- stts (decode timing) --------------------------------------
    const sttsBytes = extractBoxByPathFromMp4(
        mp4Bytes,
        "moov/trak/mdia/minf/stbl/stts"
    );

    if (!sttsBytes) {
        throw new Error("Mp4SampleExtractor: stts not found");
    }

    // FullBox header is 12 bytes
    const entryCount = readUint32(sttsBytes, 12);

    let offset = 16;

    const sttsEntries = [];

    for (let i = 0; i < entryCount; i++) {
        const sampleCount = readUint32(sttsBytes, offset);
        const sampleDuration = readUint32(sttsBytes, offset + 4);

        sttsEntries.push({
            sampleCount,
            sampleDuration
        });

        offset += 8;
    }

    console.log(
        "Mp4SampleExtractor: stts entries =",
        sttsEntries
    );

    // ---- expand stts to per-sample durations -----------------------
    const durations = [];

    for (const entry of sttsEntries) {
        for (let i = 0; i < entry.sampleCount; i++) {
            durations.push(entry.sampleDuration);
        }
    }

    if (durations.length !== samples.length) {
        throw new Error(
            `Mp4SampleExtractor: stts count mismatch (durations=${durations.length}, samples=${samples.length})`
        );
    }

    // ---- ctts (composition offsets) -------------------------------
    let compositionOffsets = null;

    const cttsBytes = extractBoxByPathFromMp4(
        mp4Bytes,
        "moov/trak/mdia/minf/stbl/ctts"
    );

    if (cttsBytes) {

        const version = cttsBytes[8];
        if (version !== 0) {
            throw new Error(
                `Mp4SampleExtractor: ctts version ${version} not supported`
            );
        }

        const entryCount = readUint32(cttsBytes, 12);
        let offset = 16;

        compositionOffsets = [];

        for (let i = 0; i < entryCount; i++) {
            const sampleCount = readUint32(cttsBytes, offset);
            const compositionOffset = readUint32(cttsBytes, offset + 4);

            for (let j = 0; j < sampleCount; j++) {
                compositionOffsets.push(compositionOffset);
            }

            offset += 8;
        }

        if (compositionOffsets.length !== samples.length) {
            throw new Error(
                `Mp4SampleExtractor: ctts count mismatch (offsets=${compositionOffsets.length}, samples=${samples.length})`
            );
        }

        console.log(
            "Mp4SampleExtractor: ctts entries expanded =",
            compositionOffsets.length
        );

    } else {
        console.log(
            "Mp4SampleExtractor: ctts not present (PTS == DTS)"
        );
    }

    // ---- stss (sync samples / keyframes) ---------------------------
    let keyframeSet = null;

    const stssBytes = extractBoxByPathFromMp4(
        mp4Bytes,
        "moov/trak/mdia/minf/stbl/stss"
    );

    if (stssBytes) {
        // FullBox header is 12 bytes
        const entryCount = readUint32(stssBytes, 12);

        let offset = 16;
        keyframeSet = new Set();

        for (let i = 0; i < entryCount; i++) {
            const sampleNumber = readUint32(stssBytes, offset);
            keyframeSet.add(sampleNumber); // 1-based
            offset += 4;
        }

        console.log(
            "Mp4SampleExtractor: stss keyframe count =",
            keyframeSet.size
        );
    } else {
        console.log(
            "Mp4SampleExtractor: stss not present (all samples are keyframes)"
        );
    }

    // ---- assign DTS / PTS -------------------------------------------
    let dts = 0;

    for (let i = 0; i < samples.length; i++) {

        const duration = durations[i];
        const compositionOffset = compositionOffsets
            ? compositionOffsets[i]
            : 0;

        samples[i].dts = dts;
        samples[i].timestamp = dts;              // DTS
        samples[i].pts = dts + compositionOffset;
        samples[i].duration = duration;

        if (keyframeSet) {
            samples[i].isKey = keyframeSet.has(i + 1);
        } else {
            samples[i].isKey = true;
        }

        dts += duration;
    }

    console.log(
        "Mp4SampleExtractor: final duration (ticks) =",
        dts
    );

    console.log(
        "Mp4SampleExtractor: total sliced bytes =",
        cursor
    );

    return samples;
}
