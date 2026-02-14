
// GoldenTruthExtractorWiring.js
//
// Declarative map of extractor registrations.
// No registry mutation.
// No side effects.

import { registerSttsGoldenTruthExtractor } from "./stts.goldenTruthExtractor.js";
import { registerStscGoldenTruthExtractor } from "./stsc.goldenTruthExtractor.js";
import { registerFtypGoldenTruthExtractor } from "./ftyp.goldenTruthExtractor.js";
import { registerTkhdGoldenTruthExtractor } from "./tkhd.goldenTruthExtractor.js";
import { registerMdhdGoldenTruthExtractor } from "./mdhd.goldenTruthExtractor.js";
import { registerMvhdGoldenTruthExtractor } from "./mvhd.goldenTruthExtractor.js";
import { registerStssGoldenTruthExtractor } from "./stss.goldenTruthExtractor.js";
import { registerCttsGoldenTruthExtractor } from "./ctts.goldenTruthExtractor.js";
import { registerStszGoldenTruthExtractor } from "./stsz.goldenTruthExtractor.js";
import { registerStcoGoldenTruthExtractor } from "./stco.goldenTruthExtractor.js";
import { registerCo64GoldenTruthExtractor } from "./co64.goldenTruthExtractor.js";
import { registerDinfGoldenTruthExtractor } from "./dinf.goldenTruthExtractor.js";
import { registerDrefGoldenTruthExtractor } from "./dref.goldenTruthExtractor.js";
import { registerStblGoldenTruthExtractor } from "./stbl.goldenTruthExtractor.js";
import { registerHdlrGoldenTruthExtractor } from "./hdlr.goldenTruthExtractor.js";
import { registerVmhdGoldenTruthExtractor } from "./vmhd.goldenTruthExtractor.js";
import { registerMinfGoldenTruthExtractor } from "./minf.goldenTruthExtractor.js";
import { registerAvcCGoldenTruthExtractor } from "./avcC.goldenTruthExtractor.js";
import { registerBtrtGoldenTruthExtractor } from "./btrt.goldenTruthExtractor.js";
import { registerPaspGoldenTruthExtractor } from "./pasp.goldenTruthExtractor.js";
import { registerMdiaGoldenTruthExtractor } from "./mdia.goldenTruthExtractor.js";
import { registerElstGoldenTruthExtractor } from "./elst.goldenTruthExtractor.js";
import { registerEdtsGoldenTruthExtractor } from "./edts.goldenTruthExtractor.js";
import { registerTrakGoldenTruthExtractor } from "./trak.goldenTruthExtractor.js";
import { registerDataGoldenTruthExtractor } from "./data.goldenTruthExtractor.js";
import { registerIlstGoldenTruthExtractor } from "./ilst.goldenTruthExtractor.js";
import { registerIlstItemGoldenTruthExtractor } from "./ilstItem.goldenTruthExtractor.js";
import { registerMetaHdlrGoldenTruthExtractor } from "./metaHdlr.goldenTruthExtractor.js";
import { registerMetaGoldenTruthExtractor } from "./meta.goldenTruthExtractor.js";
import { registerUdtaGoldenTruthExtractor } from "./udta.goldenTruthExtractor.js";
import { registerMoovGoldenTruthExtractor } from "./moov.goldenTruthExtractor.js";
import { registerFreeGoldenTruthExtractor } from "./free.goldenTruthExtractor.js";
import { registerEsdsGoldenTruthExtractor } from "./esds.goldenTruthExtractor.js";
import { registerDOpsGoldenTruthExtractor } from "./dOps.goldenTruthExtractor.js";
import { registerSbgpGoldenTruthExtractor } from "./sbgp.goldenTruthExtractor.js";
import { registerSgpdGoldenTruthExtractor } from "./sgpd.goldenTruthExtractor.js";
import { registerSmhdGoldenTruthExtractor } from "./smhd.goldenTruthExtractor.js";
import { registerMdatGoldenTruthExtractor } from "./mdat.goldenTruthExtractor.js";

import { registerStsdGoldenTruthExtractor } from "./stsd.goldenTruthExtractor.js";

import { registerAvc1SampleEntryGoldenTruthExtractor } from "./avc1-sample-entry.goldenTruthExtractor.js";
import { registerHvc1SampleEntryGoldenTruthExtractor } from "./hvc1-sample-entry.goldenTruthExtractor.js";
import { registerMp4aSampleEntryGoldenTruthExtractor } from "./mp4a-sample-entry.goldenTruthExtractor.js";
import { registerOpusSampleEntryGoldenTruthExtractor } from "./Opus-sample-entry.goldenTruthExtractor.js";

export const EXTRACTOR_WIRING = [
    ["mdat",                                    registerMdatGoldenTruthExtractor],
    ["ftyp",                                    registerFtypGoldenTruthExtractor],
    ["free",                                    registerFreeGoldenTruthExtractor],
    ["moov",                                    registerMoovGoldenTruthExtractor],
    ["moov/mvhd",                               registerMvhdGoldenTruthExtractor],
    ["moov/udta",                               registerUdtaGoldenTruthExtractor],
    ["moov/udta/meta",                          registerMetaGoldenTruthExtractor],
    ["moov/udta/meta/hdlr",                     registerMetaHdlrGoldenTruthExtractor],
    ["moov/udta/meta/ilst",                     registerIlstGoldenTruthExtractor],
    ["moov/trak",                               registerTrakGoldenTruthExtractor],
    ["moov/trak/tkhd",                          registerTkhdGoldenTruthExtractor],
    ["moov/trak/edts",                          registerEdtsGoldenTruthExtractor],
    ["moov/trak/edts/elst",                     registerElstGoldenTruthExtractor],
    ["moov/trak/mdia",                          registerMdiaGoldenTruthExtractor],
    ["moov/trak/mdia/hdlr",                     registerHdlrGoldenTruthExtractor],
    ["moov/trak/mdia/mdhd",                     registerMdhdGoldenTruthExtractor],
    ["moov/trak/mdia/minf",                     registerMinfGoldenTruthExtractor],
    ["moov/trak/mdia/minf/vmhd",                registerVmhdGoldenTruthExtractor],
    ["moov/trak/mdia/minf/smhd",                registerSmhdGoldenTruthExtractor],
    ["moov/trak/mdia/minf/dinf",                registerDinfGoldenTruthExtractor],
    ["moov/trak/mdia/minf/dinf/dref",           registerDrefGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl",                registerStblGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/sbgp",           registerSbgpGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/sgpd",           registerSgpdGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stts",           registerSttsGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsc",           registerStscGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stss",           registerStssGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/ctts",           registerCttsGoldenTruthExtractor], 
    ["moov/trak/mdia/minf/stbl/stsz",           registerStszGoldenTruthExtractor], 
    ["moov/trak/mdia/minf/stbl/stco",           registerStcoGoldenTruthExtractor], 
    ["moov/trak/mdia/minf/stbl/co64",           registerCo64GoldenTruthExtractor],

    // STSD extractor (ISO box space)
    ["moov/trak/mdia/minf/stbl/stsd", registerStsdGoldenTruthExtractor],

    // SampleEntry roots (SampleEntry schema space)
    ["moov/trak/mdia/minf/stbl/stsd|avc1", registerAvc1SampleEntryGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd|hvc1", registerHvc1SampleEntryGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd|mp4a", registerMp4aSampleEntryGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd|Opus", registerOpusSampleEntryGoldenTruthExtractor],

    // SampleEntry child boxes (ISO boxes under SampleEntry schema)
    ["moov/trak/mdia/minf/stbl/stsd|avc1/avcC", registerAvcCGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd|avc1/btrt", registerBtrtGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd|avc1/pasp", registerPaspGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd|mp4a/esds", registerEsdsGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd|mp4a/btrt", registerBtrtGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd|Opus/dOps", registerDOpsGoldenTruthExtractor],
    ["moov/trak/mdia/minf/stbl/stsd|Opus/btrt", registerBtrtGoldenTruthExtractor],

    // ---------------------------------------------------------------------------
    // NON-TRAVERSABLE SEMANTIC REGISTRATIONS
    // ---------------------------------------------------------------------------
    //
    // The following paths are INTENTIONALLY NOT TRAVERSABLE by the resolver.
    //
    // They do NOT participate in normal parent→child traversal because:
    // - ilst item atoms have dynamic FourCCs and unbounded multiplicity
    // - the traversal engine has no plural / indexed traversal here (yet)
    // - ilst contents are currently extracted as a single opaque blob
    //
    // These registrations exist for:
    // - semantic completeness
    // - contextual extractors that are handed raw bytes explicitly
    // - future traversal support once ilst item enumeration is defined
    //
    // In other words:
    // - Registration here means "I know how to interpret these bytes"
    // - It does NOT mean "the traversal engine can reach this path"
    //
    // To access ilst atoms today:
    //   resolve `moov/udta/meta/ilst`
    //   then extract item atoms contextually from its payload
    // ---------------------------------------------------------------------------
    ["moov/udta/meta/ilst/©too",      registerIlstItemGoldenTruthExtractor],
    ["moov/udta/meta/ilst/©too/data", registerDataGoldenTruthExtractor],

];


