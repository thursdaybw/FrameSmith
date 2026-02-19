/**
 * validateMp4BuildInput
 * =====================
 *
 * Grammads validator for Mp4BuildInput.
 *
 * PURPOSE
 * -------
 * This function defines the CLOSED WORLD grammar of Mp4BuildInput.
 *
 * - Any unknown field is a HARD FAILURE
 * - No defaults are applied
 * - No inference is performed
 * - No semantic validation is performed
 *
 * This is NOT policy.
 * This is NOT adaptation.
 * This is language grammar.
 *
 * If this validator passes, the input is syntactically valid.
 * If it fails, compilation MUST NOT proceed.
 */
export function validateMp4BuildInput(mp4BuildInput) {
    if (!mp4BuildInput || typeof mp4BuildInput !== "object") {
        throw new Error(
            "Mp4BuildInput must be an object"
        );
    }

    // ---------------------------------------------------------------------
    // Top-level grammar
    // ---------------------------------------------------------------------
    assertAllowedKeys(
        "Mp4BuildInput",
        mp4BuildInput,
        [
            "tracks",
            "buildHints",
            "semanticHints"
        ]
    );

    if (!Array.isArray(mp4BuildInput.tracks)) {
        throw new Error(
            "Mp4BuildInput.tracks must be an array"
        );
    }

    if (mp4BuildInput.tracks.length === 0) {
        throw new Error(
            "Mp4BuildInput.tracks must contain at least one track"
        );
    }

    mp4BuildInput.tracks.forEach((track, index) => {
        validateMp4TrackInput(track, index);
    });

}

function validateMp4TrackInput(track, trackIndex) {

    if (!track || typeof track !== "object") {
        throw new Error(
            `Mp4BuildInput.tracks[${trackIndex}] must be an object`
        );
    }

    assertAllowedKeys(
        `Mp4BuildInput.tracks[${trackIndex}]`,
        track,
        [
            "semanticCore",
            "semanticHints",
            "payloads",
            "buildParameters",
            "buildHints"
        ]
    );

    // ---------------------------------------------------------
    // semanticCore grammar
    // ---------------------------------------------------------

    const semanticCore = track.semanticCore;

    if (!semanticCore || typeof semanticCore !== "object") {
        throw new Error(
            "semanticCore must be an object"
        );
    }

    assertAllowedKeys(
        "semanticCore",
        semanticCore,
        [
            "accessUnits",
            "codec"
        ]
    );

    if (!Array.isArray(semanticCore.accessUnits)) {
        throw new Error(
            "semanticCore.accessUnits must be an array"
        );
    }

    const codec = semanticCore.codec;

    if (!codec || typeof codec !== "object") {
        throw new Error(
            "semanticCore.codec must be an object"
        );
    }

    assertAllowedKeys(
        "semanticCore.codec",
        codec,
        [
            "codec",
            "config"
        ]
    );

    if (typeof codec.codec !== "string") {
        throw new Error(
            "semanticCore.codec.codec must be a string"
        );
    }

    const config = codec.config;

    if (!config || typeof config !== "object") {
        throw new Error(
            "semanticCore.codec.config must be an object"
        );
    }

    assertAllowedKeys(
        "semanticCore.codec.config",
        config,
        [
            "representation",
            "bytes",
            "completeness"
        ]
    );

    if (
        config.representation !== "container" &&
        config.representation !== "elementary"
    ) {
        throw new Error(
            "semanticCore.codec.config.representation must be \"container\" or \"elementary\""
        );
    }

    if (
        config.representation !== "container" &&
        config.representation !== "elementary"
    ) {
        throw new Error(
            "semanticCore.codec.config.representation must be \"container\" or \"elementary\""
        );
    }

    if (config.completeness !== undefined) {
        if (
            config.completeness !== "semantic" &&
            config.completeness !== "container-complete"
        ) {
            throw new Error(
                "semanticCore.codec.config.completeness must be \"semantic\" or \"container-complete\""
            );
        }
    }

    if (!(config.bytes instanceof Uint8Array)) {
        throw new Error(
            "semanticCore.codec.config.bytes must be a Uint8Array"
        );
    }


    if (!(config.bytes instanceof Uint8Array)) {
        throw new Error(
            "semanticCore.codec.config.bytes must be a Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // payloads grammar
    // ---------------------------------------------------------

    const payloads = track.payloads;

    if (!payloads || typeof payloads !== "object") {
        throw new Error(
            "payloads must be an object"
        );
    }

    assertAllowedKeys(
        "payloads",
        payloads,
        [
            "accessUnitPayloads"
        ]
    );

    if (!Array.isArray(payloads.accessUnitPayloads)) {
        throw new Error(
            "payloads.accessUnitPayloads must be an array"
        );
    }

    // ---------------------------------------------------------
    // buildParameters grammar
    // ---------------------------------------------------------

    const buildParameters = track.buildParameters;

    if (!buildParameters || typeof buildParameters !== "object") {
        throw new Error(
            "buildParameters must be an object"
        );
    }

    assertAllowedKeys(
        "buildParameters",
        buildParameters,
        [
            "codedWidth",
            "codedHeight",
            "trackTimescale",

            // Audio-only (required by compiler for mp4a / opus)
            "channelCount",
            "sampleRate"
        ]
    );

    // ---------------------------------------------------------
    // semanticHints grammar (optional)
    // ---------------------------------------------------------

    if (
        track.semanticHints !== undefined &&
        (track.semanticHints === null ||
            typeof track.semanticHints !== "object")
    ) {
        throw new Error(
            "semanticHints must be an object if provided"
        );
    }

    // ---------------------------------------------------------
    // buildHints grammar (optional)
    // ---------------------------------------------------------

    const buildHints = track.buildHints;

    if (buildHints !== undefined) {

        if (buildHints === null || typeof buildHints !== "object") {
            throw new Error(
                "buildHints must be an object if provided"
            );
        }

        assertAllowedKeys(
            "buildHints",
            buildHints,
            [
                "compressorName",
                "udtaBytes",
                "encoderIdentity",
                "pasp",
                "btrt",
                "syncRepresentation",
                "chunkingStrategy",
                "sttsPolicy",
                "packetizationStrategy",
            ]
        );

        if (
            buildHints.udtaBytes !== undefined &&
            !(buildHints.udtaBytes instanceof Uint8Array)
        ) {
            throw new Error(
                "buildHints.udtaBytes must be a Uint8Array"
            );
        }

        if (
            buildHints.encoderIdentity !== undefined &&
            typeof buildHints.encoderIdentity !== "string"
        ) {
            throw new Error(
                "buildHints.encoderIdentity must be a string"
            );
        }

        if (
            buildHints.udtaBytes !== undefined &&
            buildHints.encoderIdentity !== undefined
        ) {
            throw new Error(
                "buildHints.udtaBytes and encoderIdentity are mutually exclusive"
            );
        }
    }
}

/**
 * assertAllowedKeys
 * -----------------
 *
 * Ensures that an object contains ONLY the explicitly allowed keys.
 *
 * Unknown keys are a HARD FAILURE.
 *
 * @param {string} context
 * @param {object} obj
 * @param {string[]} allowedKeys
 */
function assertAllowedKeys(context, obj, allowedKeys) {
    const actualKeys = Object.keys(obj);
    const illegalKeys = actualKeys.filter(
        key => !allowedKeys.includes(key)
    );

    if (illegalKeys.length === 0) {
        return;
    }

    throw new Error(
        [
            `${context}: invalid input shape`,
            ``,
            `The following field(s) are not part of the ${context} contract:`,
            `  ${illegalKeys.join(", ")}`,
            ``,
            `Allowed top-level fields are:`,
            `  ${allowedKeys.join(", ")}`,
            ``,
            `This validation is enforced at the compiler boundary`,
            `(${context} → compileMp4FromMp4Input).`,
            ``,
            `This usually indicates one of the following:`,
            `  - the input contract was updated but the validator was not`,
            `  - a source adapter is emitting fields it does not own`,
            `  - a field belongs in normalization, not in the build input`,
            ``,
            `No defaults or implicit fields are permitted.`,
            `All fields must be explicitly allowed by the contract.`
        ].join("\n")
    );
}
