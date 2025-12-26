export function deriveSttsEntries({ samples }) {

    const entries = [];

    if (samples.length === 0) {
        return entries;
    }

    let currentDuration = samples[0].duration;
    let count = 1;

    for (let i = 1; i < samples.length; i++) {
        const d = samples[i].duration;

        if (d === currentDuration) {
            count++;
        } else {
            entries.push({
                sampleCount: count,
                sampleDuration: currentDuration
            });

            currentDuration = d;
            count = 1;
        }
    }

    entries.push({
        sampleCount: count,
        sampleDuration: currentDuration
    });

    return entries;
}
