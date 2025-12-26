export function deriveStssSampleNumbers({ samples }) {
    const result = [];

    for (let i = 0; i < samples.length; i++) {
        if (samples[i].isKey === true) {
            result.push(i + 1); // MP4 is 1-based
        }
    }

    return result;
}
