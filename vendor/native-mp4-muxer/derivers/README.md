# Derivers

Derivers calculate semantic facts that are not explicitly present
in the input data.

They answer questions like:
- How long is this track?
- How are samples grouped into chunks?
- What STSC entries are implied by this grouping?
- What timing tables are implied by sample DTS/PTS values?

## Rules

Derivers:
- operate on semantic data
- may perform calculation, aggregation, or inference
- must not depend on MP4 box formats
- must not produce emitter-ready structures
- must not encode bytes
- must not apply policy defaults

Derivers create new information.
They do not reshape data for output.

## Position in the pipeline

semantic fixtures
→ derivers
→ enriched semantic data
→ adapters
→ box emitters
