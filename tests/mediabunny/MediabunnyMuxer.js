import {
    Output,
    Mp4OutputFormat,
    BufferTarget,
    EncodedVideoPacketSource,
    EncodedPacket
} from "../../vendor/mediabunny/dist/bundles/mediabunny.mjs";

// Extract SPS and PPS NALUs from the first keyframe chunk.
// Returns { sps, pps } as Uint8Array, or null if not found.
function extractSpsPps(u8) {

    // find start codes 00 00 00 01
    const positions = [];
    for (let i = 0; i < u8.length - 4; i++) {
        if (u8[i] === 0x00 &&
            u8[i+1] === 0x00 &&
            u8[i+2] === 0x00 &&
            u8[i+3] === 0x01) {
            positions.push(i);
        }
    }

    let sps = null;
    let pps = null;

    for (let i = 0; i < positions.length; i++) {
        const start = positions[i] + 4;
        const end = (i + 1 < positions.length) ? positions[i+1] : u8.length;
        const nalu = u8.subarray(start, end);
        const type = nalu[0] & 0x1F;

        if (type === 7) sps = nalu.slice(); // SPS
        if (type === 8) pps = nalu.slice(); // PPS
    }

    if (!sps || !pps) return null;
    return { sps, pps };
}

export class MediabunnyMuxer {
    constructor({ codec, width, height, fps }) {

        console.log("typeof EncodedVideoPacketSource =", typeof EncodedVideoPacketSource);
        console.log("EncodedVideoPacketSource =", EncodedVideoPacketSource);
        console.log("typeof EncodedPacket =", typeof EncodedPacket);
        console.log("EncodedPacket =", EncodedPacket);

        this.width = width;
        this.height = height;

        this.target = new BufferTarget();

        this.output = new Output({
            format: new Mp4OutputFormat(),
            target: this.target
        });

        // Create EncodedVideoPacketSource with hardcoded codec family
        this.videoSource = new EncodedVideoPacketSource("avc");

        // Attach metadata required by mediabunny
        this.output.addVideoTrack(this.videoSource, {
            width,
            height,
            frameRate: fps
        });
    }

    async start() {
        await this.output.start();
    }


    buildAvcC(sps, pps) {
        const spsLength = sps.length;
        const ppsLength = pps.length;

        const total = 7 + 2 + spsLength + 1 + 2 + ppsLength;
        const avcC = new Uint8Array(total);

        let o = 0;
        avcC[o++] = 1;                  // configurationVersion
        avcC[o++] = sps[1];             // AVCProfileIndication
        avcC[o++] = sps[2];             // profile_compatibility
        avcC[o++] = sps[3];             // AVCLevelIndication
        avcC[o++] = 0xFF;               // reserved + lengthSizeMinusOne
        avcC[o++] = 0xE1;               // reserved + numOfSequenceParameterSets
        avcC[o++] = (spsLength >> 8) & 0xff;
        avcC[o++] = spsLength & 0xff;
        avcC.set(sps, o); o += spsLength;
        avcC[o++] = 1;                  // numOfPictureParameterSets
        avcC[o++] = (ppsLength >> 8) & 0xff;
        avcC[o++] = ppsLength & 0xff;
        avcC.set(pps, o);

        return avcC.buffer;
    }


    async addVideoFrame(chunk) {

        const u8 = new Uint8Array(chunk.byteLength);
        chunk.copyTo(u8);

        // Capture SPS/PPS once
        if (!this.spsPps && chunk.type === "key") {
            this.spsPps = extractSpsPps(u8);
            console.log("SPS/PPS =", this.spsPps);
        }

        // Build metadata BEFORE creating the packet
        let metadata = undefined;

        if (this.spsPps) {
            metadata = {
                decoderConfig: {
                    codec: "avc1.42E01E",               // test-only
                    codedWidth: this.width,
                    codedHeight: this.height,
                    description: this.buildAvcC(
                        this.spsPps.sps,
                        this.spsPps.pps
                    )
                }
            };
        }

        const packet = new EncodedPacket(
            u8,
            chunk.type === "key" ? "key" : "delta",
            chunk.timestamp / 1_000_000,
            (chunk.duration ?? 33_333) / 1_000_000
        );

        if (metadata) packet.metadata = metadata;

        await this.videoSource.add(packet);
    }

    async finalize() {
        await this.output.finalize();
        return new Blob([this.target.buffer], { type: "video/mp4" });
    }
}

