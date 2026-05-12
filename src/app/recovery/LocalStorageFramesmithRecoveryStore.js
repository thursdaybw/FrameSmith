import {
    normalizeFramesmithRecoverySnapshot
} from "./FramesmithRecoverySnapshot.js";

export const DEFAULT_FRAMESMITH_RECOVERY_STORAGE_KEY = "framesmith.recovery.currentProject.v1";

function hasStorageShape(storage) {
    return !!storage &&
        typeof storage.getItem === "function" &&
        typeof storage.setItem === "function" &&
        typeof storage.removeItem === "function";
}

export function createLocalStorageFramesmithRecoveryStore({
    storage = globalThis.localStorage,
    key = DEFAULT_FRAMESMITH_RECOVERY_STORAGE_KEY,
    now = Date.now,
    logger = console
} = {}) {
    const canUseStorage = hasStorageShape(storage);

    function readSnapshot() {
        if (!canUseStorage) {
            return null;
        }
        try {
            const serialized = storage.getItem(key);
            if (!serialized) {
                return null;
            }
            return normalizeFramesmithRecoverySnapshot(JSON.parse(serialized), { now });
        } catch (error) {
            logger?.warn?.("[Recovery] failed to read Framesmith recovery snapshot", error);
            return null;
        }
    }

    function saveSnapshot(snapshot) {
        if (!canUseStorage) {
            return null;
        }
        try {
            const normalized = normalizeFramesmithRecoverySnapshot(snapshot, { now });
            storage.setItem(key, JSON.stringify(normalized));
            return normalized;
        } catch (error) {
            logger?.warn?.("[Recovery] failed to save Framesmith recovery snapshot", error);
            return null;
        }
    }

    function clearSnapshot() {
        if (!canUseStorage) {
            return;
        }
        try {
            storage.removeItem(key);
        } catch (error) {
            logger?.warn?.("[Recovery] failed to clear Framesmith recovery snapshot", error);
        }
    }

    return {
        key,
        readSnapshot,
        saveSnapshot,
        clearSnapshot
    };
}
