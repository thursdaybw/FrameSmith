import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export function composeFtypNode() {
    return EmitterRegistry.emit(
        "ftyp",
        {
            majorBrand: "isom",
            minorVersion: 512,
            compatibleBrands: ["isom", "iso2", "avc1", "mp41"]
        }
    );
}
