export function describeValue(v) {  
    if (v === null) return "null";
    if (v === undefined) return "undefined";

    const type = typeof v;

    if (type !== "object") {
        return `${v} (${type})`;
    }

    // Object case: summarize it cleanly
    try {
        const keys = Object.keys(v);
        return `object with keys [${keys.join(", ")}]`;
    } catch {
        return "object (uninspectable)";
    }
}
