export class Assembler {

    static concat(buffers) {
        // buffers: array of Uint8Array

        let total = 0;
        for (const b of buffers) total += b.length;

        const out = new Uint8Array(total);
        let offset = 0;

        for (const b of buffers) {
            out.set(b, offset);
            offset += b.length;
        }

        return out;
    }

}
