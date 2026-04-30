import { openContainerFromMp4 } from "./openContainerFromMp4.js";
import { assertIsMp4ByteSource } from "./mp4ByteSource.js";

export async function openContainerFromMp4Source({ mp4ByteSource }) {
    assertIsMp4ByteSource(mp4ByteSource);

    /*
     * Seam for large-file support:
     * today we materialize bytes once for compatibility with existing demux APIs.
     * next step is replacing this with true range-read parsing in demux/container/trackview.
     */
    const mp4Bytes = await mp4ByteSource.readAll();

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("openContainerFromMp4Source: readAll() must return Uint8Array");
    }

    return openContainerFromMp4({ mp4Bytes });
}

