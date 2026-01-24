export function deriveSyncSampleNumbers({ samples }) {

    const syncSampleNumbers = [];
    let sawSyncFlag = false;

    for (let i = 0; i < samples.length; i++) {
        if ("isKey" in samples[i]) {
            sawSyncFlag = true;
            if (samples[i].isKey === true) {
                syncSampleNumbers.push(i + 1); // MP4 is 1-based
            }
        }
    }

    if (!sawSyncFlag) {

        console.log(
            "[deriveSyncSampleNumbers] no sync flags found",
            {
                totalSamples: samples.length
            }
        );

        return {
            status: "absent",
            syncSampleNumbers: [],
            totalSampleCount: samples.length
        };
    }

    console.log(
        "[deriveSyncSampleNumbers] sync flags derived",
        {
            totalSamples: samples.length,
            syncCount: syncSampleNumbers.length,
            syncSampleNumbers
        }
    );

    return {
        status: "present",
        syncSampleNumbers,
        totalSampleCount: samples.length
    };
}
