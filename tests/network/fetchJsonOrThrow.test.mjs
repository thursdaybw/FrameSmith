import test from "node:test";
import assert from "node:assert/strict";

import { fetchJsonOrThrow } from "../../src/network/fetchJsonOrThrow.js";

test("fetchJsonOrThrow converts a hung request into a retryable timeout", async () => {
    const scheduled = [];
    const cleared = [];
    const request = fetchJsonOrThrow(
        "https://example.test/upload",
        { method: "POST" },
        {
            timeoutMs: 2500,
            setTimeoutImpl(callback, delayMs) {
                scheduled.push({ callback, delayMs });
                return scheduled.length;
            },
            clearTimeoutImpl(timeoutId) {
                cleared.push(timeoutId);
            },
            fetchImpl(url, options) {
                return new Promise((resolve, reject) => {
                    options.signal.addEventListener("abort", () => {
                        const error = new Error("The operation was aborted.");
                        error.name = "AbortError";
                        reject(error);
                    }, { once: true });
                });
            }
        }
    );

    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delayMs, 2500);

    scheduled[0].callback();

    await assert.rejects(request, (error) => {
        assert.equal(error.name, "RemoteTimeoutError");
        assert.equal(error.remote?.kind, "timeout");
        assert.equal(error.remote?.retryable, true);
        assert.equal(error.remote?.timeoutMs, 2500);
        assert.equal(error.remote?.url, "https://example.test/upload");
        return true;
    });

    assert.deepEqual(cleared, [1]);
});
