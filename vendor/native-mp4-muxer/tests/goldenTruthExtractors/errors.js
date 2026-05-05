export class IsoBoxNotFoundError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = "IsoBoxNotFoundError";
        this.details = details;
    }
}

