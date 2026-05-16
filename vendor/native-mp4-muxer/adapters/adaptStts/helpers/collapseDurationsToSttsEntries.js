export function collapseDurationsToSttsEntries(durations) {
    const entries = [];

    let currentDelta = durations[0];
    let currentCount = 1;

    for (let i = 1; i < durations.length; i++) {
        const delta = durations[i];

        if (delta === currentDelta) {
            currentCount++;
        } else {
            entries.push({
                sampleCount: currentCount,
                sampleDelta: currentDelta
            });
            currentDelta = delta;
            currentCount = 1;
        }
    }

    entries.push({
        sampleCount: currentCount,
        sampleDelta: currentDelta
    });

    return { entries };
}
