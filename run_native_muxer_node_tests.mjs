import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_NATIVE_MUXER_ROOT = "./vendor/native-mp4-muxer";

function resolveNativeMuxerRoot() {
    const requestedRoot = process.env.NATIVE_MUXER_ROOT || DEFAULT_NATIVE_MUXER_ROOT;
    return path.resolve(requestedRoot);
}

const nativeMuxerRoot = resolveNativeMuxerRoot();
const testsRoot = path.join(nativeMuxerRoot, "tests");
const indexHtmlPath = path.join(testsRoot, "index.html");

function createFileFetch(baseDir) {
    const nativeFetch = globalThis.fetch;

    return async function fileAwareFetch(input, init) {
        const urlText = typeof input === "string" ? input : String(input?.url ?? input);
        const isHttp = /^https?:\/\//i.test(urlText);
        const isData = /^data:/i.test(urlText);
        const isFileUrl = /^file:\/\//i.test(urlText);

        if (isHttp || isData) {
            return nativeFetch(input, init);
        }

        const filePath = isFileUrl
            ? new URL(urlText)
            : path.resolve(baseDir, urlText);

        let bytes;
        try {
            bytes = await fs.readFile(filePath instanceof URL ? filePath : filePath);
        } catch {
            return {
                ok: false,
                status: 404,
                statusText: "Not Found",
                async arrayBuffer() {
                    return new ArrayBuffer(0);
                }
            };
        }

        return {
            ok: true,
            status: 200,
            statusText: "OK",
            async arrayBuffer() {
                return bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength
                );
            },
            async text() {
                return bytes.toString("utf8");
            },
            async json() {
                return JSON.parse(bytes.toString("utf8"));
            }
        };
    };
}

function extractModuleScript(html) {
    const scriptMatch = html.match(/<script\s+type="module">([\s\S]*?)<\/script>/i);
    if (!scriptMatch) {
        throw new Error(`Could not find <script type="module"> in ${indexHtmlPath}`);
    }
    return scriptMatch[1];
}

function extractNamedImports(moduleScript) {
    const imports = [];
    const importRegex = /import\s*\{([\s\S]*?)\}\s*from\s*"([^"]+)"\s*;?/g;

    let match;
    while ((match = importRegex.exec(moduleScript)) !== null) {
        const names = match[1]
            .split(",")
            .map(name => name.trim())
            .filter(Boolean)
            .map(name => name.replace(/\s+as\s+.+$/, "").trim())
            .filter(Boolean);

        imports.push({
            from: match[2],
            names
        });
    }

    return imports;
}

function stripComments(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
}

function extractTestsAllList(moduleScript) {
    const testsMatch = moduleScript.match(/const\s+testsAll\s*=\s*\[([\s\S]*?)\]\s*;/m);
    if (!testsMatch) {
        throw new Error(`Could not find testsAll list in ${indexHtmlPath}`);
    }

    const cleaned = stripComments(testsMatch[1]);

    return cleaned
        .split(",")
        .map(token => token.trim())
        .filter(Boolean)
        .filter(token => /^[A-Za-z_$][\w$]*$/.test(token));
}

function isBrowserOnlyFailure(error) {
    const message = `${error?.message ?? error}`;
    return (
        message.includes("is not defined") && (
            message.includes("VideoEncoder") ||
            message.includes("AudioEncoder") ||
            message.includes("VideoDecoder") ||
            message.includes("AudioDecoder") ||
            message.includes("OffscreenCanvas") ||
            message.includes("ImageBitmap") ||
            message.includes("document") ||
            message.includes("window") ||
            message.includes("navigator")
        )
    ) || message.includes("WebCodecs") || message.includes("not supported in this environment");
}

function isOptionalOracleDependencyFailure(error) {
    const message = `${error?.message ?? error}`;
    return message.includes("vendor/mp4box.js/dist/mp4box.all.cjs");
}

async function loadSymbolTable(imports) {
    const symbolToModule = new Map();

    for (const { from, names } of imports) {
        const modulePath = path.resolve(testsRoot, from);
        const moduleUrl = pathToFileURL(modulePath).href;
        const loadedModule = await import(moduleUrl);

        for (const name of names) {
            if (symbolToModule.has(name)) {
                continue;
            }
            symbolToModule.set(name, {
                modulePath,
                exported: loadedModule[name]
            });
        }
    }

    return symbolToModule;
}

async function run() {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = createFileFetch(testsRoot);

    let passCount = 0;
    let failCount = 0;
    let skipCount = 0;

    try {
        const html = await fs.readFile(indexHtmlPath, "utf8");
        const moduleScript = extractModuleScript(html);
        const imports = extractNamedImports(moduleScript);
        const testNames = extractTestsAllList(moduleScript);
        const symbolTable = await loadSymbolTable(imports);

        console.log(`NativeMuxer root: ${nativeMuxerRoot}`);
        console.log(`Running NativeMuxer index.html unit tests in Node (${testNames.length})`);

        for (const testName of testNames) {
            const symbol = symbolTable.get(testName);

            if (!symbol || typeof symbol.exported !== "function") {
                failCount++;
                console.log(`FAIL ${testName}`);
                console.error(new Error(`Missing test export '${testName}' from imported modules`));
                continue;
            }

            try {
                process.stdout.write(`RUN  ${testName}\n`);
                await symbol.exported();
                passCount++;
                process.stdout.write(`PASS ${testName}\n`);
            } catch (error) {
                if (isBrowserOnlyFailure(error)) {
                    skipCount++;
                    process.stdout.write(`SKIP ${testName}\n`);
                    console.log(`  reason: ${error?.message ?? String(error)}`);
                    continue;
                }

                failCount++;
                process.stdout.write(`FAIL ${testName}\n`);
                console.error(error);
            }
        }

        const nodeOnlyTests = [
            {
                name: "test_nativeDemux_vs_mp4box_phoneFixture",
                modulePath: path.join(testsRoot, "node/test_nativeDemux_vs_mp4box_phoneFixture.mjs"),
                exportName: "test_nativeDemux_vs_mp4box_phoneFixture"
            }
        ];

        for (const nodeOnly of nodeOnlyTests) {
            try {
                process.stdout.write(`RUN  ${nodeOnly.name}\n`);
                const moduleUrl = pathToFileURL(nodeOnly.modulePath).href;
                const loaded = await import(moduleUrl);
                const fn = loaded[nodeOnly.exportName];
                if (typeof fn !== "function") {
                    throw new Error(`Missing export '${nodeOnly.exportName}' in ${nodeOnly.modulePath}`);
                }
                const result = await fn();
                if (result?.skipped === true) {
                    skipCount++;
                    process.stdout.write(`SKIP ${nodeOnly.name}\n`);
                } else {
                    passCount++;
                    process.stdout.write(`PASS ${nodeOnly.name}\n`);
                }
            } catch (error) {
                if (isOptionalOracleDependencyFailure(error)) {
                    skipCount++;
                    process.stdout.write(`SKIP ${nodeOnly.name}\n`);
                    console.log(`  reason: optional mp4box.js oracle dependency is not installed`);
                    continue;
                }

                failCount++;
                process.stdout.write(`FAIL ${nodeOnly.name}\n`);
                console.error(error);
            }
        }
    } finally {
        globalThis.fetch = previousFetch;
    }

    console.log("NativeMuxer Node unit summary", {
        passCount,
        failCount,
        skipCount
    });

    if (failCount > 0) {
        throw new Error(`NativeMuxer node tests completed with ${failCount} failure(s)`);
    }
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
