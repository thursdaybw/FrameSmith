import { EmitterRegistry } from "./EmitterRegistry.js";

// Terminal emitters
import { registerAvcCEmitter } from "../box-emitters/stsdBox/avcCBox.js";
import { registerBtrtEmitter } from "../box-emitters/stsdBox/btrtBox.js";
import { registerPaspEmitter } from "../box-emitters/stsdBox/paspBox.js";
import { registerEsdsEmitter } from "../box-emitters/stsdBox/esdsBox.js";
import { registerDOpsEmitter } from "../box-emitters/stsdBox/dOpsBox.js";
import { registerAvc1SampleEntryEmitter } from "../box-emitters/stsdBox/avc1SampleEntryBox.js";
import { registerMp4aSampleEntryEmitter } from "../box-emitters/stsdBox/mp4aSampleEntryBox.js";
import { registerOpusSampleEntryEmitter } from "../box-emitters/stsdBox/opusSampleEntry.js";
import { registerStsdEmitter } from "../box-emitters/stsdBox.js";
import { registerSbgpEmitter } from "../box-emitters/sbgpBox.js";
import { 
    registerSgpdFixedEmitter,
    registerSgpdVariableEmitter
} from "../box-emitters/sgpdBox.js";
import {
    registerStszFixedEmitter,
    registerStszVariableEmitter
} from "../box-emitters/stszBox.js";

import { registerSttsEmitter } from "../box-emitters/sttsBox.js";
import { registerStscEmitter } from "../box-emitters/stscBox.js";
import { registerStcoEmitter } from "../box-emitters/stcoBox.js";
import { registerStssEmitter } from "../box-emitters/stssBox.js";
import { registerCttsEmitter } from "../box-emitters/cttsBox.js";
import { registerStblEmitter } from "../box-emitters/stblBox.js";
import { registerIlstItemEmitter } from "../box-emitters/ilstItemBox.js";
import { registerDataEmitter } from "../box-emitters/dataBox.js";
import { registerIlstEmitter } from "../box-emitters/ilstBox.js";
import { registerMetaHdlrEmitter } from "../box-emitters/metaHdlrBox.js";
import { registerMetaEmitter } from "../box-emitters/metaBox.js";
import { registerUdtaEmitter } from "../box-emitters/udtaBox.js";
import { registerDrefEmitter } from "../box-emitters/drefBox.js";
import { registerDinfEmitter } from "../box-emitters/dinfBox.js";
import { registerVmhdEmitter } from "../box-emitters/vmhdBox.js";
import { registerSmhdEmitter } from "../box-emitters/smhdBox.js";
import { registerMinfEmitter } from "../box-emitters/minfBox.js";
import { registerHdlrEmitter } from "../box-emitters/hdlrBox.js";
import { registerMdhdEmitter } from "../box-emitters/mdhdBox.js";
import { registerMdiaEmitter } from "../box-emitters/mdiaBox.js";
import { registerTkhdEmitter } from "../box-emitters/tkhdBox.js";
import { registerEdtsEmitter } from "../box-emitters/edtsBox.js";
import { registerTrakEmitter } from "../box-emitters/trakBox.js";
import { registerElstEmitter } from "../box-emitters/elstBox.js";
import { registerMvhdEmitter } from "../box-emitters/mvhdBox.js";
import { registerMoovEmitter } from "../box-emitters/moovBox.js";
import { registerFtypEmitter } from "../box-emitters/ftypBox.js";
import { registerFreeEmitter } from "../box-emitters/freeBox.js";
import { registerMdatEmitter } from "../box-emitters/mdatBox.js";

// Container assemblers
// import { registerAvc1Assembler } from "../assemblers/stsdBox/assembleAvc1.js";
import { registerMp4aSampleEntryAssembler } from "../assemblers/stsdBox/assembleMp4aSampleEntry.js";
import { registerAvc1SampleEntryAssembler } from "../assemblers/stsdBox/assembleAvc1SampleEntry.js";
import { registerOpusSampleEntryAssembler } from "../assemblers/stsdBox/assembleOpusSampleEntry.js";
import { registerStsdAssembler } from "../assemblers/assembleStsd.js";
import { registerStblAssembler } from "../assemblers/assembleStbl.js";
import { registerIlstItemAssembler } from "../assemblers/assembleIlstItem.js";
import { registerIlstAssembler } from "../assemblers/assembleIlst.js";
import { registerMetaAssembler } from "../assemblers/assembleMeta.js";
import { registerUdtaAssembler } from "../assemblers/assembleUdta.js";
import { registerDrefAssembler } from "../assemblers/assembleDref.js";
import { registerDinfAssembler } from "../assemblers/assembleDinf.js";
import { registerMinfAssembler } from "../assemblers/assembleMinf.js";
import { registerMdiaAssembler } from "../assemblers/assembleMdia.js";
import { registerTrakAssembler } from "../assemblers/assembleTrak.js";
import { registerEdtsAssembler } from "../assemblers/assembleEdts.js";
import { registerMoovAssembler } from "../assemblers/assembleMoov.js";


/**
 * EMITTER_WIRING
 * ==============
 *
 * This file is a bootstrap list for registering emitters and assemblers.
 *
 * It does NOT define how boxes are built.
 * It does NOT define what paths are valid.
 * It simply tells the system which registration functions to run at startup.
 *
 * ---------------------------------------------------------------------
 * How this works
 * ---------------------------------------------------------------------
 *
 * Each entry in EMITTER_WIRING is:
 *
 *   [ <id>, <installerFunction> ]
 *
 * Example:
 *
 *   ["btrt:shared", registerBtrtEmitter]
 *
 * The string key is ONLY an identifier.
 * It does not have to be a real schema path.
 * It is not used for routing or validation.
 *
 * The real work happens inside the installer function.
 *
 * For example, registerBtrtEmitter() may call:
 *
 *   registry.registerEmitter("moov/.../avc1/btrt", emitBtrtBox);
 *   registry.registerEmitter("moov/.../mp4a/btrt", emitBtrtBox);
 *
 * Those schema paths are what actually matter.
 *
 * ---------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------
 *
 * This file exists so that:
 * - all emitters and assemblers are registered in one place
 * - startup is deterministic and explicit
 * - no module self-registers as a side effect of being imported
 *
 * Think of this file as a "wiring harness":
 * it connects implementation functions to the registry,
 * but it does not define structure or behaviour itself.
 *
 * ---------------------------------------------------------------------
 * Key rule
 * ---------------------------------------------------------------------
 *
 * The key in EMITTER_WIRING must be UNIQUE,
 * but it does NOT need to match a schema path.
 *
 * Schema paths are enforced only inside:
 *   registry.registerEmitter(...)
 *   registry.registerAssembler(...)
 *
 * If something is not registered there, the system will refuse to build it.
 */
export const EMITTER_WIRING = [
    // Mp4 Box Emitters
    ["moov/trak/mdia/minf/stbl/stsd|avc1/avcC",         registerAvcCEmitter],
    ["moov/trak/mdia/minf/stbl/stsd|avc1/pasp",         registerPaspEmitter],
    ["moov/trak/mdia/minf/stbl/stsd|mp4a/esds",         registerEsdsEmitter],
    ["moov/trak/mdia/minf/stbl/stsd|Opus/dOps",         registerDOpsEmitter],
    ["moov/trak/mdia/minf/stbl/stsd",                   registerStsdEmitter],
    ["moov/trak/mdia/minf/stbl/sbgp",                   registerSbgpEmitter],
    ["moov/trak/mdia/minf/stbl/sgpd|fixed",        registerSgpdFixedEmitter],
    ["moov/trak/mdia/minf/stbl/sgpd|variable",  registerSgpdVariableEmitter],
    ["moov/trak/mdia/minf/stbl/stsz|fixed",        registerStszFixedEmitter],
    ["moov/trak/mdia/minf/stbl/stsz|variable",  registerStszVariableEmitter],
    ["moov/trak/mdia/minf/stbl/stts",                   registerSttsEmitter],
    ["moov/trak/mdia/minf/stbl/stsc",                   registerStscEmitter],
    ["moov/trak/mdia/minf/stbl/stco",                   registerStcoEmitter],
    ["moov/trak/mdia/minf/stbl/stss",                   registerStssEmitter],
    ["moov/trak/mdia/minf/stbl/ctts",                   registerCttsEmitter],
    ["moov/trak/mdia/minf/stbl",                        registerStblEmitter],
    ["moov/udta/meta/ilst/{atom}",                  registerIlstItemEmitter],
    ["moov/udta/meta/ilst/{atom}/data",                 registerDataEmitter],
    ["moov/udta/meta/ilst",                             registerIlstEmitter],
    ["moov/udta/meta/hdlr",                         registerMetaHdlrEmitter],
    ["moov/udta/meta",                                  registerMetaEmitter],
    ["moov/udta",                                       registerUdtaEmitter],
    ["moov/trak/mdia/minf/dinf/dref",                   registerDrefEmitter],
    ["moov/trak/mdia/minf/dinf",                        registerDinfEmitter],
    ["moov/trak/mdia/minf/vmhd",                        registerVmhdEmitter],
    ["moov/trak/mdia/minf/smhd",                        registerSmhdEmitter],
    ["moov/trak/mdia/minf",                             registerMinfEmitter],
    ["moov/trak/mdia/hdrl",                             registerHdlrEmitter],
    ["moov/trak/mdia/mdhd",                             registerMdhdEmitter],
    ["moov/trak/mdia",                                  registerMdiaEmitter],
    ["moov/trak/tkhd",                                  registerTkhdEmitter],
    ["moov/trak/edts/elst",                             registerElstEmitter],
    ["moov/trak/edts",                                  registerEdtsEmitter],
    ["moov/trak",                                       registerTrakEmitter],
    ["moov/mvhd",                                       registerMvhdEmitter],
    ["moov",                                            registerMoovEmitter],
    ["ftyp",                                            registerFtypEmitter],
    ["free",                                            registerFreeEmitter],
    ["mdat",                                            registerMdatEmitter],

    // NOTE: {avc1|mp4a} here is NOT expanded or interpreted.
    // This entry just points to an installer that registers
    // concrete paths (…/avc1/btrt, …/mp4a/btrt) internally.
    ["moov/trak/mdia/minf/stbl/stsd|{avc1|mp4a|Opus}/btrt",  registerBtrtEmitter],

    // Sample Entry Emitters
    ["moov/trak/mdia/minf/stbl/stsd|mp4a",   registerMp4aSampleEntryEmitter],
    ["moov/trak/mdia/minf/stbl/stsd|avc1",   registerAvc1SampleEntryEmitter],
    ["moov/trak/mdia/minf/stbl/stsd|Opus",   registerOpusSampleEntryEmitter],

];

export const ASSEMBLER_WIRING = [
    // Mp4 Box Aseemblers
    ["moov/trak/mdia/minf/stbl/stsd",                  registerStsdAssembler],
    ["moov/udta/meta/ilst/{atom}",                 registerIlstItemAssembler],
    ["moov/udta/meta/ilst",                            registerIlstAssembler],
    ["moov/udta/meta",                                 registerMetaAssembler],
    ["moov/udta",                                      registerUdtaAssembler],

    // Sample Entry Assemblers 
    ["moov/trak/mdia/minf/stbl/stsd|mp4a",  registerMp4aSampleEntryAssembler],
    ["moov/trak/mdia/minf/stbl/stsd|avc1",  registerAvc1SampleEntryAssembler],
    ["moov/trak/mdia/minf/stbl/stsd|Opus",  registerOpusSampleEntryAssembler],
    ["moov/trak/mdia/minf/stbl",                       registerStblAssembler],
    ["moov/trak/mdia/minf/dinf/dref",                  registerDrefAssembler],
    ["moov/trak/mdia/minf/dinf",                       registerDinfAssembler],
    ["moov/trak/mdia/minf",                            registerMinfAssembler],
    ["moov/trak/mdia",                                 registerMdiaAssembler],
    ["moov/trak/edts",                                 registerEdtsAssembler],
    ["moov/trak",                                      registerTrakAssembler],
    ["moov",                                           registerMoovAssembler],
];
