import {
    createEmptyFramesmithRecoverySnapshot,
    mergeFramesmithRecoverySnapshot,
    normalizeFramesmithRecoverySnapshot,
    hasFramesmithRecoveryTask,
    hasFramesmithRecoveryTranscript
} from "./FramesmithRecoverySnapshot.js";
import { createLocalStorageFramesmithRecoveryStore } from "./LocalStorageFramesmithRecoveryStore.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function createMemoryStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
}

export function test_framesmithRecoverySnapshot_createsEmptyStableShape() {
    const snapshot = createEmptyFramesmithRecoverySnapshot({ now: () => 1000 });

    assert(snapshot.schemaVersion === 1, "snapshot schema version must be explicit");
    assert(snapshot.savedAt === 1000, "snapshot must capture save time");
    assert(snapshot.taskId === null, "empty snapshot must not invent a task ID");
    assert(snapshot.transcriptText === "", "empty snapshot must expose empty transcript text");
    assert(Array.isArray(snapshot.overlayItems), "empty snapshot must expose overlay item array");
    assert(!hasFramesmithRecoveryTask(snapshot), "empty snapshot must not report a task");
    assert(!hasFramesmithRecoveryTranscript(snapshot), "empty snapshot must not report transcript artifacts");
}

export function test_framesmithRecoverySnapshot_mergesAndNormalizesDurableState() {
    const previous = createEmptyFramesmithRecoverySnapshot({ now: () => 1000 });
    const snapshot = mergeFramesmithRecoverySnapshot(previous, {
        baseUrl: " https://example.test ",
        videoId: " video-1 ",
        videoSourceKey: " clip.mp4:123:456 ",
        taskId: " task-1 ",
        taskStatus: " completed ",
        statusPayload: { status: "completed", transcript_ready: true },
        whisperJson: { segments: [{ text: "Hello" }] },
        overlayItems: [{ words: [{ text: "Hello" }] }],
        transcriptText: "Hello",
        lastError: ""
    }, { now: () => 2000 });

    assert(snapshot.savedAt === 2000, "merge must advance savedAt");
    assert(snapshot.baseUrl === "https://example.test", "baseUrl must be trimmed");
    assert(snapshot.videoId === "video-1", "videoId must be trimmed");
    assert(snapshot.videoSourceKey === "clip.mp4:123:456", "source key must be retained");
    assert(snapshot.taskId === "task-1", "task ID must be trimmed");
    assert(snapshot.taskStatus === "completed", "task status must be retained");
    assert(snapshot.lastError === null, "blank last error must normalize to null");
    assert(hasFramesmithRecoveryTask(snapshot), "snapshot with taskId must report a task");
    assert(hasFramesmithRecoveryTranscript(snapshot), "snapshot with transcript artifacts must report transcript");
}

export function test_framesmithRecoverySnapshot_dropsUnserializablePatchValues() {
    const snapshot = mergeFramesmithRecoverySnapshot(null, {
        taskId: "task-1",
        statusPayload: {
            status: "launching",
            callback: () => "not durable"
        },
        overlayItems: [
            {
                words: [{ text: "Hello" }],
                callback: () => "not durable"
            }
        ]
    }, { now: () => 3000 });

    assert(snapshot.taskId === "task-1", "serializable values must survive");
    assert(
        typeof snapshot.statusPayload.callback === "undefined",
        "function values must be removed from objects"
    );
    assert(
        typeof snapshot.overlayItems[0].callback === "undefined",
        "function values must be removed from arrays"
    );
}

export function test_framesmithRecoverySnapshot_normalizesMalformedInput() {
    const snapshot = normalizeFramesmithRecoverySnapshot({
        schemaVersion: 999,
        savedAt: "not a number",
        taskId: 123,
        overlayItems: "not an array",
        statusPayload: "not an object",
        transcriptText: 123
    }, { now: () => 4000 });

    assert(snapshot.schemaVersion === 1, "schema version must be reset to current version");
    assert(snapshot.savedAt === 4000, "bad savedAt must fall back to now");
    assert(snapshot.taskId === null, "non-string task ID must be rejected");
    assert(Array.isArray(snapshot.overlayItems), "bad overlay items must normalize to an array");
    assert(snapshot.overlayItems.length === 0, "bad overlay items must normalize empty");
    assert(snapshot.statusPayload === null, "bad status payload must normalize to null");
    assert(snapshot.transcriptText === "", "bad transcript text must normalize empty");
}

export function test_localStorageFramesmithRecoveryStore_roundTripsSnapshot() {
    const storage = createMemoryStorage();
    const store = createLocalStorageFramesmithRecoveryStore({
        storage,
        key: "test.framesmith.recovery",
        now: () => 5000,
        logger: null
    });

    const saved = store.saveSnapshot({
        taskId: "task-1",
        transcriptText: "Recovered transcript"
    });
    const restored = store.readSnapshot();

    assert(saved.taskId === "task-1", "save must return normalized snapshot");
    assert(restored.taskId === "task-1", "read must restore task ID");
    assert(restored.transcriptText === "Recovered transcript", "read must restore transcript text");
    store.clearSnapshot();
    assert(store.readSnapshot() === null, "clear must remove stored snapshot");
}

export function test_localStorageFramesmithRecoveryStore_toleratesInvalidJson() {
    const storage = createMemoryStorage();
    storage.setItem("test.framesmith.recovery", "{not json");
    const store = createLocalStorageFramesmithRecoveryStore({
        storage,
        key: "test.framesmith.recovery",
        logger: null
    });

    assert(store.readSnapshot() === null, "invalid JSON must not crash recovery startup");
}

export const FRAMESMITH_RECOVERY_TESTS = [
    test_framesmithRecoverySnapshot_createsEmptyStableShape,
    test_framesmithRecoverySnapshot_mergesAndNormalizesDurableState,
    test_framesmithRecoverySnapshot_dropsUnserializablePatchValues,
    test_framesmithRecoverySnapshot_normalizesMalformedInput,
    test_localStorageFramesmithRecoveryStore_roundTripsSnapshot,
    test_localStorageFramesmithRecoveryStore_toleratesInvalidJson
];
