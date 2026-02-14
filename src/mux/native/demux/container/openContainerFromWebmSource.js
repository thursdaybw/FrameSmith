import { assertIsWebmByteSource } from "./webmByteSource.js";

export async function openContainerFromWebmSource({ webmByteSource }) {
    assertIsWebmByteSource(webmByteSource);
    throw new Error("openContainer: WebM routing is not implemented yet");
}

