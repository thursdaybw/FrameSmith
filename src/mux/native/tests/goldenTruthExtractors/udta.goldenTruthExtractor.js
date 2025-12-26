import { asContainer } from "../../box-model/Box.js";
import { getGoldenTruthBox } from "./index.js";
import { emitMetaBox } from "../../box-emitters/metaBox.js";

function readUdtaBoxFieldsFromBoxBytes(box) {
    return { raw: box };
}

function getUdtaBuilderInputFromBoxBytes(box) {
    const container = asContainer(box);
    const children = [];

    for (const child of container.enumerateChildren()) {

        switch (child.type) {

            case "meta": {
                const childBytes = box.slice(
                    child.offset,
                    child.offset + child.size
                );

                const truth = getGoldenTruthBox.fromBox(
                    childBytes,
                    "moov/udta/meta"
                );

                children.push(
                    emitMetaBox(truth.getBuilderInput())
                );
                break;
            }

            default:
                throw new Error(
                    `UDTA golden truth: unsupported child '${child.type}'`
                );
        }
    }

    return { children };
}

export function registerUdtaGoldenTruthExtractor(register) {
    register.readFields(readUdtaBoxFieldsFromBoxBytes);
    register.getBuilderInput(getUdtaBuilderInputFromBoxBytes);
}
