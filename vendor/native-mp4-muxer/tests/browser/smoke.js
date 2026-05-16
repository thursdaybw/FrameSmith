import {
    test_NativeMuxer_EndToEnd_FromWebCodecs_Semantic
} from "../test_NativeMuxer_EndToEnd_FromWebCodecs_Semantic.js";

const runButton = document.getElementById("run");
const downloadCheckbox = document.getElementById("download");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

function writeLog(level, args) {
    const line = `[${level}] ${args.map(value => {
        if (typeof value === "string") return value;
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }).join(" ")}`;

    logEl.textContent += `${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text) {
    statusEl.textContent = text;
}

function assertBrowserCapability(name) {
    if (typeof globalThis[name] === "undefined") {
        throw new Error(`${name} is not available in this browser context`);
    }
}

async function runSmokeTest() {
    logEl.textContent = "";
    setStatus("Running native muxer WebCodecs smoke test…");
    runButton.disabled = true;

    const originalDebugDownload = window.DEBUG_DOWNLOAD_MP4;
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
        originalLog(...args);
        writeLog("log", args);
    };
    console.warn = (...args) => {
        originalWarn(...args);
        writeLog("warn", args);
    };
    console.error = (...args) => {
        originalError(...args);
        writeLog("error", args);
    };

    try {
        assertBrowserCapability("VideoEncoder");
        assertBrowserCapability("AudioEncoder");
        assertBrowserCapability("OffscreenCanvas");

        window.DEBUG_DOWNLOAD_MP4 = downloadCheckbox.checked;
        await test_NativeMuxer_EndToEnd_FromWebCodecs_Semantic();
        setStatus("PASS: WebCodecs encoded media, native muxer compiled MP4, and structural checks passed.");
    } catch (error) {
        console.error(error);
        setStatus(`FAIL: ${error?.message ?? String(error)}`);
        throw error;
    } finally {
        window.DEBUG_DOWNLOAD_MP4 = originalDebugDownload;
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
        runButton.disabled = false;
    }
}

runButton.addEventListener("click", () => {
    runSmokeTest().catch(() => {
        // Error details are already written to the page and console.
    });
});
