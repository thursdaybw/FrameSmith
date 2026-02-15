#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

function parseArgs(argv) {
    const args = {
        baseUrl: "http://127.0.0.1:8000",
        fixture: "./phonetestmp4s/phone-5sec.mp4",
        indexPath: "/index.html",
        timeoutMs: 180_000,
        pollMs: 1_000,
        devtoolsPort: 9222,
        outDir: "artifacts/phone-e2e",
        startServer: false,
        serverPort: 8000,
        noAdb: false,
        skipLaunch: false,
        wsUrl: null,
        devtoolsUrl: null
    };

    for (let index = 2; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];
        if (arg === "--help" || arg === "-h") {
            args.help = true;
            continue;
        }
        if (arg === "--start-server") {
            args.startServer = true;
            continue;
        }
        if (arg === "--no-adb") {
            args.noAdb = true;
            args.skipLaunch = true;
            continue;
        }
        if (arg === "--skip-launch") {
            args.skipLaunch = true;
            continue;
        }
        if (arg === "--ws-url" && next) {
            args.wsUrl = next;
            args.noAdb = true;
            args.skipLaunch = true;
            index += 1;
            continue;
        }
        if (arg === "--devtools-url" && next) {
            args.devtoolsUrl = next;
            args.noAdb = true;
            args.skipLaunch = true;
            index += 1;
            continue;
        }
        if (arg === "--base-url" && next) {
            args.baseUrl = next;
            index += 1;
            continue;
        }
        if (arg === "--fixture" && next) {
            args.fixture = next;
            index += 1;
            continue;
        }
        if (arg === "--index-path" && next) {
            args.indexPath = next;
            index += 1;
            continue;
        }
        if (arg === "--timeout-ms" && next) {
            args.timeoutMs = Number(next);
            index += 1;
            continue;
        }
        if (arg === "--poll-ms" && next) {
            args.pollMs = Number(next);
            index += 1;
            continue;
        }
        if (arg === "--devtools-port" && next) {
            args.devtoolsPort = Number(next);
            index += 1;
            continue;
        }
        if (arg === "--out-dir" && next) {
            args.outDir = next;
            index += 1;
            continue;
        }
        if (arg === "--server-port" && next) {
            args.serverPort = Number(next);
            index += 1;
            continue;
        }
        throw new Error(`Unknown or incomplete arg: ${arg}`);
    }

    return args;
}

function printHelp() {
    console.log(`
Phone browser E2E runner (ADB + Chrome DevTools CDP)

Usage:
  node scripts/phone-e2e-runner.mjs [options]

Options:
  --base-url <url>       Existing app base URL. Default: http://127.0.0.1:8000
  --fixture <path>       Fixture path passed to query param. Default: ./phonetestmp4s/phone-5sec.mp4
  --index-path <path>    App page path. Default: /index.html
  --timeout-ms <n>       Overall timeout in ms. Default: 180000
  --poll-ms <n>          Poll interval in ms. Default: 1000
  --devtools-port <n>    Local forwarded DevTools port. Default: 9222
  --out-dir <path>       Output folder for logs/artifacts. Default: artifacts/phone-e2e
  --start-server         Start local python http server (off by default)
  --server-port <n>      Local server port when --start-server is set. Default: 8000
  --no-adb               Do not run adb commands; attach to existing DevTools target
  --skip-launch          Do not launch URL; expect target already open on phone
  --ws-url <url>         Direct CDP websocket URL (implies --no-adb --skip-launch)
  --devtools-url <url>   Full Chrome Inspect/DevTools frontend URL containing ws=
  --help                 Show this help

Examples:
  node scripts/phone-e2e-runner.mjs --base-url https://dev.bevansbench.com
  node scripts/phone-e2e-runner.mjs --start-server --server-port 8000
  node scripts/phone-e2e-runner.mjs --base-url https://dev.bevansbench.com --no-adb
  node scripts/phone-e2e-runner.mjs --ws-url ws://127.0.0.1:9222/devtools/page/ABC
  node scripts/phone-e2e-runner.mjs --devtools-url 'devtools://devtools/bundled/inspector.html?ws=127.0.0.1:9222/devtools/page/ABC'
`);
}

function createTimestampLabel() {
    return new Date().toISOString().replaceAll(":", "-");
}

function shellQuote(value) {
    return `'${String(value).replaceAll("'", `'\"'\"'`)}'`;
}

function deriveWsUrl({ wsUrl, devtoolsUrl }) {
    if (typeof wsUrl === "string" && wsUrl.trim().length > 0) {
        return wsUrl.trim();
    }
    if (typeof devtoolsUrl !== "string" || devtoolsUrl.trim().length === 0) {
        return null;
    }
    let parsed;
    try {
        parsed = new URL(devtoolsUrl.trim());
    } catch {
        return null;
    }
    const wsParam = parsed.searchParams.get("ws");
    if (!wsParam || wsParam.trim().length === 0) {
        return null;
    }
    if (wsParam.startsWith("ws://") || wsParam.startsWith("wss://")) {
        return wsParam;
    }
    return `ws://${wsParam}`;
}

function runCommand({ cmd, args, captureStdout = true }) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            stdio: captureStdout ? ["ignore", "pipe", "pipe"] : "ignore"
        });
        let stdout = "";
        let stderr = "";
        if (captureStdout) {
            child.stdout.on("data", (chunk) => {
                stdout += String(chunk);
            });
            child.stderr.on("data", (chunk) => {
                stderr += String(chunk);
            });
        }
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code !== 0) {
                reject(new Error(`${cmd} ${args.join(" ")} failed (${code}): ${stderr || stdout}`));
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

async function adb(args) {
    return runCommand({ cmd: "adb", args, captureStdout: true });
}

async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`GET ${url} failed (${response.status})`);
    }
    return response.json();
}

async function isDevtoolsEndpointReachable({ devtoolsPort }) {
    try {
        const targets = await getJson(`http://127.0.0.1:${devtoolsPort}/json/list`);
        return Array.isArray(targets);
    } catch {
        return false;
    }
}

class CdpClient {
    constructor({ webSocketUrl }) {
        this.webSocketUrl = webSocketUrl;
        this.nextId = 1;
        this.pending = new Map();
        this.eventHandlers = new Map();
        this.ws = null;
    }

    async connect() {
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(this.webSocketUrl);
            this.ws = ws;
            ws.on("open", resolve);
            ws.on("error", reject);
            ws.on("message", (raw) => {
                const message = JSON.parse(String(raw));
                if (typeof message.id === "number") {
                    const pending = this.pending.get(message.id);
                    if (!pending) return;
                    this.pending.delete(message.id);
                    if (message.error) {
                        pending.reject(new Error(JSON.stringify(message.error)));
                        return;
                    }
                    pending.resolve(message.result);
                    return;
                }
                const handlers = this.eventHandlers.get(message.method);
                if (!handlers) return;
                for (const handler of handlers) {
                    handler(message.params);
                }
            });
        });
    }

    on(method, handler) {
        const list = this.eventHandlers.get(method) || [];
        list.push(handler);
        this.eventHandlers.set(method, list);
    }

    async send(method, params = {}) {
        const id = this.nextId++;
        const payload = { id, method, params };
        const promise = new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
        });
        this.ws.send(JSON.stringify(payload));
        return promise;
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

function buildAppUrl({ baseUrl, indexPath, fixture }) {
    const url = new URL(indexPath, baseUrl);
    url.searchParams.set("fixture", fixture);
    url.searchParams.set("fixtureAutoEncode", "1");
    url.searchParams.set("encodeDiagnostics", "1");
    url.searchParams.set("e2eRunId", String(Date.now()));
    return url.toString();
}

async function waitForInspectableTarget({ devtoolsPort, expectedUrl, timeoutMs }) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
        const targets = await getJson(`http://127.0.0.1:${devtoolsPort}/json/list`);
        const match = targets.find((target) => {
            const value = String(target.url || "");
            return value.includes(expectedUrl);
        });
        if (match && match.webSocketDebuggerUrl) {
            return match;
        }
        await delay(500);
    }
    throw new Error(`Timed out waiting for inspectable target: ${expectedUrl}`);
}

async function pullLatestExportFromPhone({ outDir }) {
    const { stdout } = await adb([
        "shell",
        "sh",
        "-lc",
        "find /sdcard/Download -maxdepth 1 -type f -name 'framesmith-export*.mp4' 2>/dev/null | sort | tail -n 1"
    ]);
    const remotePath = String(stdout || "")
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("/") && line.endsWith(".mp4")) || "";
    if (!remotePath) {
        return null;
    }
    const localPath = path.join(outDir, path.basename(remotePath));
    try {
        await adb(["pull", remotePath, localPath]);
    } catch (error) {
        return {
            remotePath,
            localPath,
            pullError: error?.message ?? String(error)
        };
    }
    return {
        remotePath,
        localPath
    };
}

async function pullExportBlobFromPage({ client, outDir, timestamp }) {
    const evalResult = await client.send("Runtime.evaluate", {
        expression: `(() => {
            const blob = window.__lastBlob;
            if (!blob) {
                return { ok: false, reason: "window.__lastBlob missing" };
            }
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const dataUrl = String(reader.result || "");
                    const comma = dataUrl.indexOf(",");
                    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
                    resolve({
                        ok: true,
                        mimeType: blob.type || "application/octet-stream",
                        size: blob.size || 0,
                        base64
                    });
                };
                reader.onerror = () => {
                    resolve({ ok: false, reason: "FileReader failed" });
                };
                reader.readAsDataURL(blob);
            });
        })();`,
        returnByValue: true,
        awaitPromise: true
    });

    const value = evalResult?.result?.value || {};
    if (!value.ok || typeof value.base64 !== "string" || value.base64.length === 0) {
        return null;
    }

    const buffer = Buffer.from(value.base64, "base64");
    const localPath = path.join(outDir, `framesmith-export-${timestamp}.mp4`);
    await writeFile(localPath, buffer);
    return {
        localPath,
        bytes: buffer.byteLength,
        mimeType: value.mimeType || "application/octet-stream",
        source: "page-memory"
    };
}

async function waitForExportBlobInPage({
    client,
    timeoutMs,
    pollMs
}) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
        const evalResult = await client.send("Runtime.evaluate", {
            expression: `(() => {
                const blob = window.__lastBlob;
                return {
                    hasBlob: !!blob,
                    size: blob ? Number(blob.size || 0) : 0
                };
            })();`,
            returnByValue: true
        });
        const value = evalResult?.result?.value || {};
        if (value.hasBlob && value.size > 0) {
            return true;
        }
        await delay(pollMs);
    }
    return false;
}

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) {
        printHelp();
        return;
    }
    const explicitWsUrl = deriveWsUrl({
        wsUrl: args.wsUrl,
        devtoolsUrl: args.devtoolsUrl
    });

    await mkdir(args.outDir, { recursive: true });
    const timestamp = createTimestampLabel();
    const diagnosticsPath = path.join(args.outDir, `diagnostics-${timestamp}.log`);
    const consolePath = path.join(args.outDir, `console-${timestamp}.json`);
    const summaryPath = path.join(args.outDir, `summary-${timestamp}.json`);

    let serverProcess = null;
    if (args.startServer) {
        serverProcess = spawn("python3", ["-m", "http.server", String(args.serverPort)], {
            stdio: "ignore"
        });
        await delay(600);
    }

    const appUrl = buildAppUrl({
        baseUrl: args.baseUrl,
        indexPath: args.indexPath,
        fixture: args.fixture
    });

    try {
        let cdpReachable = await isDevtoolsEndpointReachable({
            devtoolsPort: args.devtoolsPort
        });

        if (!args.noAdb) {
            if (!cdpReachable && args.startServer) {
                try {
                    await adb([
                        "reverse",
                        `tcp:${args.serverPort}`,
                        `tcp:${args.serverPort}`
                    ]);
                } catch {}
            }
            if (!cdpReachable) {
                try {
                    await adb([
                        "forward",
                        `tcp:${args.devtoolsPort}`,
                        "localabstract:chrome_devtools_remote"
                    ]);
                } catch {}
            }

            if (!args.skipLaunch) {
                const quotedUrl = shellQuote(appUrl);
                const launchCommand = [
                    `am start -a android.intent.action.VIEW -d ${quotedUrl} -p com.android.chrome`,
                    `am start -n com.android.chrome/com.google.android.apps.chrome.Main -a android.intent.action.VIEW -d ${quotedUrl}`,
                    `am start -a android.intent.action.VIEW -d ${quotedUrl}`
                ].join(" >/dev/null 2>&1 || ");
                try {
                    await adb([
                        "shell",
                        "sh",
                        "-lc",
                        `${launchCommand} >/dev/null 2>&1 || true`
                    ]);
                } catch {}
            }

            cdpReachable = await isDevtoolsEndpointReachable({
                devtoolsPort: args.devtoolsPort
            });
        }

        if (!cdpReachable) {
            throw new Error(
                `DevTools endpoint is not reachable at http://127.0.0.1:${args.devtoolsPort}. ` +
                `Open phone target in chrome://inspect first, or set up adb forward for that port.`
            );
        }

        let target = null;
        if (explicitWsUrl) {
            target = {
                url: appUrl,
                webSocketDebuggerUrl: explicitWsUrl
            };
        } else {
            target = await waitForInspectableTarget({
                devtoolsPort: args.devtoolsPort,
                expectedUrl: appUrl,
                timeoutMs: Math.min(60_000, args.timeoutMs)
            });
        }

        const client = new CdpClient({
            webSocketUrl: target.webSocketDebuggerUrl
        });
        const consoleEvents = [];
        try {
            await client.connect();
            await client.send("Runtime.enable");
            await client.send("Page.enable");
            await client.send("Log.enable");

            client.on("Runtime.consoleAPICalled", (params) => {
                const values = Array.isArray(params.args)
                    ? params.args.map((item) => item.value ?? item.description ?? null)
                    : [];
                consoleEvents.push({
                    type: params.type,
                    values,
                    timestamp: params.timestamp
                });
            });

            const startedAt = Date.now();
            let lastText = "";
            let summaryFound = false;
            while (Date.now() - startedAt <= args.timeoutMs) {
                const evalResult = await client.send("Runtime.evaluate", {
                    expression: `(() => {
                        const panel = document.getElementById("encodeDiagnosticsPanel");
                        const status = document.getElementById("videoSourceStatus");
                        const text = panel ? String(panel.textContent || "") : "";
                        return {
                            status: status ? String(status.textContent || "") : "",
                            diagnosticsText: text,
                            hasSummary: text.includes("[Encode][SUMMARY]"),
                            hasFailure: text.includes('"ok":false'),
                            hasSuccess: text.includes('"ok":true')
                        };
                    })();`,
                    returnByValue: true
                });
                const value = evalResult?.result?.value || {};
                lastText = String(value.diagnosticsText || "");
                if (value.hasSummary) {
                    summaryFound = true;
                    break;
                }
                await delay(args.pollMs);
            }

            await writeFile(diagnosticsPath, lastText, "utf8");
            await writeFile(consolePath, JSON.stringify(consoleEvents, null, 2), "utf8");

            const exportBlobReady = await waitForExportBlobInPage({
                client,
                timeoutMs: 10_000,
                pollMs: 250
            });
            const pulledFromPage = await pullExportBlobFromPage({
                client,
                outDir: args.outDir,
                timestamp
            });
            const pulledFromDownload = args.noAdb
                ? null
                : await pullLatestExportFromPhone({ outDir: args.outDir });
            const summary = {
                ok: summaryFound,
                appUrl,
                diagnosticsPath,
                consolePath,
                exportBlobReady,
                pulledExportFromPage: pulledFromPage,
                pulledExportFromDownload: pulledFromDownload
            };
            await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
            console.log(JSON.stringify(summary, null, 2));
        } finally {
            client.close();
        }
    } finally {
        if (!args.noAdb) {
            try {
                await adb(["forward", "--remove", `tcp:${args.devtoolsPort}`]);
            } catch {}
            if (args.startServer) {
                try {
                    await adb(["reverse", "--remove", `tcp:${args.serverPort}`]);
                } catch {}
            }
        }
        if (serverProcess) {
            serverProcess.kill("SIGTERM");
        }
    }
}

main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
});
