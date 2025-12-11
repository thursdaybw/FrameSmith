import { buildStsdBox } from "./boxes/stsdBox.js";
import { buildSttsBox } from "./boxes/sttsBox.js";
import { buildStscBox } from "./boxes/stscBox.js";
import { buildStszBox } from "./boxes/stszBox.js";
import { buildStcoBox } from "./boxes/stcoBox.js";
import { buildMdhdBox } from "./boxes/mdhdBox.js";
import { buildTkhdBox } from "./boxes/tkhdBox.js";
import { buildMvhdBox } from "./boxes/mvhdBox.js";
import { buildMoovBox } from "./boxes/moovBox.js";
import { buildFtypBox } from "./boxes/ftypBox.js";
import { buildHdlrBox } from "./boxes/hdlrBox.js";
import { buildVmhdBox } from "./boxes/vmhdBox.js";
import { buildDrefBox } from "./boxes/drefBox.js";
import { buildMdatBox } from "./mdatBuilder.js";

export const BoxFactory = {
    stsd: buildStsdBox,
    stts: buildSttsBox,
    stsc: buildStscBox,
    stsz: buildStszBox,
    stco: buildStcoBox,
    mdhd: buildMdhdBox,
    tkhd: buildTkhdBox,
    mvhd: buildMvhdBox,
    moov: buildMoovBox,
    ftyp: buildFtypBox,
    hdlr: buildHdlrBox,
    vmhd: buildVmhdBox,
    dref: buildDrefBox,
    mdat: buildMdatBox,
};
