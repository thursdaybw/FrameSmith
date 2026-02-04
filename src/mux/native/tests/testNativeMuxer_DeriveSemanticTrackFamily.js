import { deriveSemanticTrackFamily } from "../derivers/deriveSemanticTrackFamily.js";
import { assertEqual} from "./assertions.js";


export function testNativeMuxer_DeriveSemanticTrackFamily() {

    const cases = [
        { codec: "avc1",          expected: "video" },
        { codec: "avc1.640028",   expected: "video" },
        { codec: "mp4a",          expected: "audio" },
        { codec: "mp4a.40.2",     expected: "audio" },
        { codec: "opus",          expected: "audio" },
    ];

    for (const { codec, expected } of cases) {

        const track = {
            semanticCore: {
                codec: { codec }
            }
        };

        const actual = deriveSemanticTrackFamily(track);

        assertEqual(
            `deriveSemanticTrackFamily(${codec})`,
            actual,
            expected
        );
    }

}
