# Adapters

Adapters translate semantic data into MP4 box emitter input.

They express existing facts in the shape required by emitters.
They do not invent new information.

## Rules

Adapters:
- perform no inference
- apply no defaults
- do not guess or collapse data
- do not change semantic meaning
- fail loudly if required input is missing

Adapters only reshape, encode, or normalize data.

## Examples

- samples → STTS builder input
- samples → CTTS builder input
- codec configuration → STSD builder input
- track metadata → HDLR builder input

## Position in the pipeline

semantic data
→ adapters
→ emitter input
→ box emitters
