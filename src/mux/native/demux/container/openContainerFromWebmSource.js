import { assertIsWebmByteSource } from "./webmByteSource.js";
import { registerWebmDemuxExtractors } from "../webm/registry/registerWebmDemuxExtractors.js";

export async function openContainerFromWebmSource({ webmByteSource }) {
    assertIsWebmByteSource(webmByteSource);
    registerWebmDemuxExtractors();
    throw new Error("openContainer: WebM routing is not implemented yet");
}
