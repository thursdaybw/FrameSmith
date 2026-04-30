import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";

import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { buildUdtaIntentFromBuildHints } from "../builders/buildUdtaIntentFromBuildHints.js";

import { buildMdatPayloadAndChunkLayout } from "../mdat/buildMdatPayloadAndChunkLayout.js";
import { composeMoovNode } from "../composers/composeMoovNode.js";
import { composeFtypNode } from "../composers/composeFtypNode.js";
import { composeFreeNode } from "../composers/composeFreeNode.js";
import { materializePassOneTopLevelBoxes } from "../layout/materializePassOneTopLevelBoxes.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertExists, assertEqual } from "./assertions.js";
import { assertBytesWithStubbedStco } from "./assertBytesWithStubbedStco.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";

export async function testNativeMuxer_MaterializePassOneTopLevelBoxes_EqualsOracle() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4"
    ];

    for (const fixture of fixtures) {

        // ---------------------------------------------------------
        // Load oracle
        // ---------------------------------------------------------
        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

        // ---------------------------------------------------------
        // Compiler pass 1
        // ---------------------------------------------------------
        prepareTracksForStructuralDerivation({ mp4CompilerState });

        // Test-owned policy override
        // overriding the compiler default.
        mp4CompilerState.buildParameters.fileBoxOrder = [ "ftyp", "free", "mdat", "moov" ];

        for (const track of mp4CompilerState.tracks) {
            deriveStructuralStateInPlace({ track });
            buildStblChildIntentsWithoutOffsetsInPlace({ track });
            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
            track.storedIntent.minfIntent = buildMinfIntentFromTrack({ track });
            track.storedIntent.mdiaIntent = buildMdiaIntentFromTrack({ track });
        }

        mp4CompilerState.storedIntent.mvhd = buildMvhdIntentFromCompilerState({ mp4CompilerState });

        for (const track of mp4CompilerState.tracks) {
            track.storedIntent.trakIntent = buildTrakIntentFromTrakAndMvhd({ track, mvhd: mp4CompilerState.storedIntent.mvhd });
        }

        mp4CompilerState.storedIntent.udta = buildUdtaIntentFromBuildHints({ buildHints: mp4CompilerState.buildHints })

        mp4CompilerState.mdat = buildMdatPayloadAndChunkLayout({ mp4CompilerState });

        mp4CompilerState.storedTopLevelNodes.moov = composeMoovNode({
            mvhdIntent: mp4CompilerState.storedIntent.mvhd,
            trakIntents: mp4CompilerState.tracks.map(t => t.storedIntent.trakIntent),
            udtaIntent: mp4CompilerState.storedIntent.udta ?? null
        });

        mp4CompilerState.storedTopLevelNodes.ftyp = composeFtypNode();
        mp4CompilerState.storedTopLevelNodes.free = composeFreeNode();

        // ---------------------------------------------------------
        // Act: materialize pass-one boxes
        // ---------------------------------------------------------
        const boxesBeforeMdat = materializePassOneTopLevelBoxes({
            topLevelNodes: mp4CompilerState.storedTopLevelNodes,
            fileBoxOrder: mp4CompilerState.buildParameters.fileBoxOrder
        });

        // ---------------------------------------------------------
        // Assertions — existence & order (policy-derived)
        // ---------------------------------------------------------
        assertExists("boxesBeforeMdat exist", boxesBeforeMdat);
        assertEqual("top-level box count", boxesBeforeMdat.length, 2);

        assertEqual("box[0].type", boxesBeforeMdat[0].type, "ftyp");
        assertEqual("box[1].type", boxesBeforeMdat[1].type, "free");

        // ---------------------------------------------------------
        // Assertions — materialization (non-fatal first)
        // ---------------------------------------------------------
        for (const box of boxesBeforeMdat) {
            assertExists(`${box.type}.bytes exists`, box.bytes);
            assertEqual( `${box.type}.bytes is Uint8Array`, box.bytes instanceof Uint8Array, true);
        }

        // ---------------------------------------------------------
        // Assertions — invariants
        // ---------------------------------------------------------
        const freeBox = boxesBeforeMdat[1];
        assertEqual("free box size is 8 bytes", freeBox.byteLength, 8);

        // ---------------------------------------------------------
        // Assertions — oracle fidelity (stub STCO)
        // ---------------------------------------------------------
        const oracleMoovBytes = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, "moov")
            .readBoxReport()
            .raw;

        const oracleFtypBytes = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, "ftyp")
            .readBoxReport()
            .raw;

        assertBytesWithStubbedStco({ labelPrefix: "ftyp", compilerBytes: boxesBeforeMdat[0].bytes, oracleBytes: oracleFtypBytes });

        for (const box of boxesBeforeMdat) {
            assertEqual( `${box.type}.byteLength matches bytes.length`, box.byteLength, box.bytes.length);
        }

        // ---------------------------------------------------------
        // Assertions — total size consistency
        // ---------------------------------------------------------
        const sumByteLength = boxesBeforeMdat.reduce((n, b) => n + b.byteLength, 0);
        const sumBytesLength = boxesBeforeMdat.reduce((n, b) => n + b.bytes.length, 0);

        assertEqual( "sum(byteLength) equals sum(bytes.length)", sumByteLength, sumBytesLength);


    }
}
