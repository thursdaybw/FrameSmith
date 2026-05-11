/**
 * Remote JSON fetch helpers for Framesmith app orchestration.
 *
 * Invariant:
 * - A retryable request must eventually succeed or fail within a bounded time.
 * - A hung transport is not a successful in-flight operation; it prevents the
 *   caller's retry policy from taking over and can strand UX state forever.
 */

function defaultIsBrowserOffline() {
    return typeof navigator !== "undefined" && navigator.onLine === false;
}

function createRemoteRequestTimeoutError({ url, timeoutMs }) {
    const error = new Error(`Request timed out after ${timeoutMs}ms for ${url}.`);
    error.name = "RemoteTimeoutError";
    error.remote = {
        kind: "timeout",
        retryable: true,
        url,
        timeoutMs
    };
    return error;
}

function createRemoteAbortError({ url, error }) {
    const wrapped = new Error(
        `Request was aborted for ${url}. Original error: ${error?.message || String(error)}`
    );
    wrapped.name = "RemoteAbortError";
    wrapped.cause = error;
    wrapped.remote = {
        kind: "aborted",
        retryable: true,
        url
    };
    return wrapped;
}

function createRemoteTransportError({ url, error, isBrowserOffline }) {
    const wrapped = new Error(
        `Network request failed for ${url}. If this is cross-origin, check CORS and auth cookies. ` +
        `Original error: ${error?.message || String(error)}`
    );
    wrapped.name = "RemoteTransportError";
    wrapped.cause = error;
    wrapped.remote = {
        kind: isBrowserOffline() ? "offline" : "network",
        retryable: true,
        url
    };
    return wrapped;
}

function createRemoteHttpError({ url, response, parsed, text }) {
    const error = new Error(
        `Request failed (${response.status}) ${url}: ${parsed?.error || text || response.statusText}`
    );
    error.name = "RemoteHttpError";
    error.remote = {
        kind: "http",
        status: response.status,
        retryable: response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500,
        url,
        responseBody: text,
        responseJson: parsed
    };
    return error;
}

function createRemoteParseError({ url, text }) {
    const error = new Error(`Expected JSON response from ${url}`);
    error.name = "RemoteParseError";
    error.remote = {
        kind: "invalid_json",
        retryable: true,
        url,
        responseBody: text
    };
    return error;
}

function isAbortError(error) {
    return !!error && (
        error.name === "AbortError" ||
        error.code === 20
    );
}

function createRequestControllerState({
    url,
    timeoutMs,
    upstreamSignal,
    abortControllerFactory,
    setTimeoutImpl,
    clearTimeoutImpl
}) {
    const controller = abortControllerFactory();
    const state = {
        timedOut: false,
        upstreamAborted: false
    };
    let timeoutId = null;
    let removeUpstreamAbortListener = () => {};

    if (upstreamSignal && typeof upstreamSignal.addEventListener === "function") {
        const relayAbort = () => {
            state.upstreamAborted = true;
            controller.abort();
        };
        if (upstreamSignal.aborted) {
            relayAbort();
        } else {
            upstreamSignal.addEventListener("abort", relayAbort, { once: true });
            removeUpstreamAbortListener = () => upstreamSignal.removeEventListener("abort", relayAbort);
        }
    }

    if (timeoutMs > 0) {
        timeoutId = setTimeoutImpl(() => {
            state.timedOut = true;
            controller.abort();
        }, timeoutMs);
    }

    return {
        signal: controller.signal,
        state,
        dispose() {
            if (timeoutId !== null) {
                clearTimeoutImpl(timeoutId);
            }
            removeUpstreamAbortListener();
        },
        buildTimeoutError() {
            return createRemoteRequestTimeoutError({ url, timeoutMs });
        }
    };
}

export async function fetchJsonOrThrow(url, options = {}, dependencies = {}) {
    const {
        timeoutMs = 0,
        fetchImpl = globalThis.fetch.bind(globalThis),
        abortControllerFactory = () => new AbortController(),
        setTimeoutImpl = globalThis.setTimeout.bind(globalThis),
        clearTimeoutImpl = globalThis.clearTimeout.bind(globalThis),
        isBrowserOffline = defaultIsBrowserOffline
    } = dependencies;

    const requestController = createRequestControllerState({
        url,
        timeoutMs,
        upstreamSignal: options?.signal,
        abortControllerFactory,
        setTimeoutImpl,
        clearTimeoutImpl
    });

    let response;
    try {
        response = await fetchImpl(url, {
            ...options,
            signal: requestController.signal
        });
    } catch (error) {
        requestController.dispose();
        if (requestController.state.timedOut) {
            throw requestController.buildTimeoutError();
        }
        if (requestController.state.upstreamAborted || isAbortError(error)) {
            throw createRemoteAbortError({ url, error });
        }
        throw createRemoteTransportError({ url, error, isBrowserOffline });
    }

    requestController.dispose();
    const text = await response.text();
    let parsed = null;
    try {
        parsed = text.length > 0 ? JSON.parse(text) : null;
    } catch {
        parsed = null;
    }
    if (!response.ok) {
        throw createRemoteHttpError({ url, response, parsed, text });
    }
    if (parsed === null) {
        throw createRemoteParseError({ url, text });
    }
    return parsed;
}

export const __test__ = {
    createRemoteRequestTimeoutError,
    createRequestControllerState,
    createRemoteTransportError,
    createRemoteAbortError,
    isAbortError
};
