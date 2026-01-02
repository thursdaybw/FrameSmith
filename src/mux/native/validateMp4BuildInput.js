/**
 * validateMp4BuildInput
 * =====================
 *
 * Grammar validator for Mp4BuildInput.
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
            "semanticCore",
            "semanticHints",
            "payloads",
            "buildParameters",
            "buildHints"
        ]
    );

    // ---------------------------------------------------------------------
    // semanticCore grammar
    // ---------------------------------------------------------------------

    const semanticCore = mp4BuildInput.semanticCore;

    if (!semanticCore || typeof semanticCore !== "object") {
        throw new Error(
            "Mp4BuildInput.semanticCore must be an object"
        );
    }

    assertAllowedKeys(
        "Mp4BuildInput.semanticCore",
        semanticCore,
        [
            "accessUnits",
            "codec"
        ]
    );

    // ---------------------------------------------------------------------
    // semanticCore.accessUnits grammar
    // ---------------------------------------------------------------------

    if (!Array.isArray(semanticCore.accessUnits)) {
        throw new Error(
            "semanticCore.accessUnits must be an array"
        );
    }

    // We do NOT validate the contents here.
    // Shape is enforced elsewhere.
    // Grammar only checks that the key exists and is correctly typed.

    // ---------------------------------------------------------------------
    // semanticCore.codec grammar
    // ---------------------------------------------------------------------

    const codec = semanticCore.codec;

    if (!codec || typeof codec !== "object") {
        throw new Error(
            "semanticCore.codec must be an object"
        );
    }

    assertAllowedKeys(
        "Mp4BuildInput.semanticCore.codec",
        codec,
        [
            "codec",
            "avcC",
            "avcCCompleteness"
        ]
    );

    if (typeof codec.codec !== "string") {
        throw new Error(
            "semanticCore.codec.codec must be a string"
        );
    }

    if (!(codec.avcC instanceof Uint8Array)) {
        throw new Error(
            "semanticCore.codec.avcC must be a Uint8Array"
        );
    }

    if (typeof codec.avcCCompleteness !== "string") {
        throw new Error(
            "semanticCore.codec.avcCCompleteness must be a string"
        );
    }

    if (
        codec.avcCCompleteness !== "semantic" &&
        codec.avcCCompleteness !== "container-complete"
    ) {
        throw new Error(
            [
                "semanticCore.codec.avcCCompleteness has invalid value",
                "",
                "Allowed values are:",
                '  - "semantic"',
                '  - "container-complete"',
                "",
                `Received: ${codec.avcCCompleteness}`
            ].join("\n")
        );
    }

    if (!codec || typeof codec !== "object") {
        throw new Error(
            "semanticCore.codec must be an object"
        );
    }

    assertAllowedKeys(
        "Mp4BuildInput.semanticCore.codec",
        codec,
        [
            "codec",
            "avcC",
            "avcCCompleteness"
        ]
    );

    if (typeof codec.avcCCompleteness !== "string") {
        throw new Error(
            "semanticCore.codec.avcCCompleteness must be a string"
        );
    }

    if (
        codec.avcCCompleteness !== "semantic" &&
        codec.avcCCompleteness !== "container-complete"
    ) {
        throw new Error(
            [
                "semanticCore.codec.avcCCompleteness has invalid value",
                "",
                "Allowed values are:",
                '  - "semantic"',
                '  - "container-complete"',
                "",
                `Received: ${codec.avcCCompleteness}`
            ].join("\n")
        );
    }

    // ---------------------------------------------------------------------
    // payloads grammar
    // ---------------------------------------------------------------------

    const payloads = mp4BuildInput.payloads;

    if (!payloads || typeof payloads !== "object") {
        throw new Error(
            "Mp4BuildInput.payloads must be an object"
        );
    }

    assertAllowedKeys(
        "Mp4BuildInput.payloads",
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


    // ---------------------------------------------------------------------
    // buildParameters grammar
    // ---------------------------------------------------------------------

    const buildParameters = mp4BuildInput.buildParameters;

    if (!buildParameters || typeof buildParameters !== "object") {
        throw new Error(
            "Mp4BuildInput.buildParameters must be an object"
        );
    }

    assertAllowedKeys(
        "Mp4BuildInput.buildParameters",
        buildParameters,
        [
            "codedWidth",
            "codedHeight",
            "trackTimescale"
        ]
    );

    // ---------------------------------------------------------------------
    // semanticHints grammar (optional)
    // ---------------------------------------------------------------------

    const semanticHints = mp4BuildInput.semanticHints;

    if (semanticHints !== undefined) {

        if (semanticHints === null || typeof semanticHints !== "object") {
            throw new Error(
                "Mp4BuildInput.semanticHints must be an object if provided"
            );
        }

    // Closed-world placeholder:
    // semanticHints is owned by source adapters and normalization,
    // NOT interpreted at the compiler boundary.
    //
    // Therefore:
    //   - keys are allowed
    //   - structure is intentionally NOT validated here
    //
    // Future normalization stages may assert structure explicitly.
}

    // ---------------------------------------------------------------------
    // buildHints grammar (optional)
    // ---------------------------------------------------------------------

    const buildHints = mp4BuildInput.buildHints;

    if (buildHints !== undefined) {

        if (buildHints === null || typeof buildHints !== "object") {
            throw new Error(
                "Mp4BuildInput.buildHints must be an object if provided"
            );
        }

        assertAllowedKeys(
            "Mp4BuildInput.buildHints",
            buildHints,
            [
                "btrt",
                "compressorName",

                // udta-related hints (mutually exclusive)
                "udtaBytes",
                "encoderIdentity"
            ]
        );

        // -----------------------------------------------------------------
        // buildHints.udtaBytes grammar (optional, opaque passthrough)
        // -----------------------------------------------------------------

        if (buildHints.udtaBytes !== undefined) {
            if (!(buildHints.udtaBytes instanceof Uint8Array)) {
                throw new Error(
                    "buildHints.udtaBytes must be a Uint8Array if provided"
                );
            }
        }

        // -----------------------------------------------------------------
        // buildHints.encoderIdentity grammar (optional, semantic identity)
        // -----------------------------------------------------------------

        if (buildHints.encoderIdentity !== undefined) {
            if (typeof buildHints.encoderIdentity !== "string") {
                throw new Error(
                    "buildHints.encoderIdentity must be a string if provided"
                );
            }
        }

        // -----------------------------------------------------------------
        // buildHints.udta exclusivity rule
        // -----------------------------------------------------------------

        if (
            buildHints.udtaBytes !== undefined &&
            buildHints.encoderIdentity !== undefined
        ) {
            throw new Error(
                [
                    "Mp4BuildInput.buildHints invalid combination",
                    "",
                    "The following fields are mutually exclusive:",
                    "  - buildHints.udtaBytes (opaque udta passthrough)",
                    "  - buildHints.encoderIdentity (semantic identity)",
                    "",
                    "Provide at most one.",
                    "",
                    "Rationale:",
                    "  - udtaBytes preserves historical metadata verbatim",
                    "  - encoderIdentity declares new authorship metadata",
                    "  - mixing the two would silently corrupt provenance"
                ].join("\n")
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
