import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export function composeMoovNode({ mvhdIntent, trakIntents, udtaIntent }) {
    const moovIntent = {
        mvhd: mvhdIntent,
        traks: trakIntents,
        udta:
            udtaIntent && udtaIntent.children
                ? udtaIntent
                : null
    };

    return EmitterRegistry.assemble("moov", moovIntent);
}
