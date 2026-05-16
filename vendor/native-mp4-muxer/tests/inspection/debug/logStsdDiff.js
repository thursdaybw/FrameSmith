import { readStsdFieldsFromRaw } from "../../../inspection/semantic/FieldReaders.js";

export function logStsdDiff({
    leftRaw,
    rightRaw,
    leftLabel,
    rightLabel,
}) {
    const left  = readStsdFieldsFromRaw(leftRaw);
    const right = readStsdFieldsFromRaw(rightRaw);

    console.log(`=== STSD FIELD DIFF (${leftLabel} vs ${rightLabel}) ===`);

    for (const section of ["stsd", "sampleEntry"]) {
        for (const key of Object.keys(left[section])) {
            console.log(
                `${section}.${key}:`,
                `${leftLabel} =`, left[section][key],
                "|",
                `${rightLabel} =`, right[section][key]
            );
        }
    }

    console.log(
        "trailingBytes:",
        `${leftLabel} =`, left.trailingBytes,
        "|",
        `${rightLabel} =`, right.trailingBytes
    );

    console.log("=== END STSD DIFF ===");
}
