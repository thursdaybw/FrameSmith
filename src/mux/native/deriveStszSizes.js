export function deriveStszSizes({ samples }) {
    return samples.map(s => s.bytes.length);
}
