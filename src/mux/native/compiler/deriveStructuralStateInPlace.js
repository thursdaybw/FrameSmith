import { deriveDecodeTimestampsInPlace } from "../derivers/deriveDecodeTimestampsInPlace.js";
import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { deriveStscEntries } from "../derivers/deriveStscEntries.js";
import { deriveStssSampleNumbers } from "../derivers/deriveStssSampleNumbers.js";
import { deriveTrackDuration } from "../derivers/deriveTrackDuration.js";
import { DecodeOrderStrategies} from "../derivers/strategies/decodeOrderStrategies.js";

export function deriveStructuralStateInPlace(mp4CompilerState) {

    const accessUnits =
        mp4CompilerState.semanticCore.accessUnits;

    // ---------------------------------------------------------
    // Decode timestamp derivation (compiler-owned)
    // ---------------------------------------------------------

    deriveDecodeTimestampsInPlace({
        accessUnits,
        strategy:
        DecodeOrderStrategies.DECODE_ORDER_EQUALS_SAMPLE_ORDER
    });

    // ---------------------------------------------------------
    // Chunk topology (strategy-selected)
    // ---------------------------------------------------------

    mp4CompilerState.chunks = deriveChunkModel(
        accessUnits,
        "all-samples-one-chunk"
    );

    // ---------------------------------------------------------
    // Sample table derivations
    // ---------------------------------------------------------

    mp4CompilerState.stscEntries = deriveStscEntries({
        samples: accessUnits,
        chunks: mp4CompilerState.chunks
    });

    mp4CompilerState.stssSampleNumbers = deriveStssSampleNumbers({
        samples: accessUnits
    });

    mp4CompilerState.trackDuration = deriveTrackDuration({
        samples: accessUnits
    });
}


