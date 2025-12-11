export function dumpBoxes(buffer, start, size) {
    console.log("=== BOX DUMP START ===");
    let p = start;
    const end = start + size;

    while (p < end) {
        const boxSize =
            (buffer[p] << 24) |
            (buffer[p+1] << 16) |
            (buffer[p+2] << 8) |
            (buffer[p+3]);

        const type = String.fromCharCode(
            buffer[p+4],
            buffer[p+5],
            buffer[p+6],
            buffer[p+7]
        );

        console.log("BOX", type, "AT", p, "SIZE", boxSize);

        if (boxSize <= 0) {
            console.error("INVALID BOX SIZE AT", p);
            break;
        }

        p += boxSize;
    }
    console.log("=== BOX DUMP END ===");
}
