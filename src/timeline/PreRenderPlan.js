export class PreRenderPlan {
    constructor({ fragments }) {
        if (!Array.isArray(fragments)) {
            throw new Error("PreRenderPlan: fragments must be an array");
        }

        this.fragments = fragments;
        Object.freeze(this.fragments);
        Object.freeze(this);
    }
}
