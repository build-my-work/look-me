import {
  TIMELINE_PREDECESSOR_TYPES,
  TIMELINE_RETENTION_DAYS,
  type TimelineEvent,
  type TimelineEventInput,
  type TimelineEventType,
  type TimelineRange,
  type TimelineSession,
  mergeTimelineEvents,
} from "./timeline";

const DATABASE_NAME = "look-me:timeline:v1";
const DATABASE_VERSION = 1;
const EVENT_STORE = "events";
const SESSION_STORE = "sessions";
const SESSION_HEARTBEAT_MS = 3_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

type TimelineListener = () => void;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function createSessionId(): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `${Date.now()}-${randomPart}`;
}

function selectMemoryEvents(
  events: readonly TimelineEvent[],
  from: number,
  to: number,
): TimelineEvent[] {
  const selected = events.filter((event) => event.at >= from && event.at < to);
  for (const type of TIMELINE_PREDECESSOR_TYPES) {
    let predecessor: TimelineEvent | undefined;
    for (const event of events) {
      if (
        event.type === type &&
        event.at < from &&
        (!predecessor || event.at > predecessor.at)
      ) {
        predecessor = event;
      }
    }
    if (predecessor) {
      selected.push(predecessor);
    }
  }
  return mergeTimelineEvents(selected);
}

export class TimelineRepository {
  readonly currentSessionId = createSessionId();

  private readonly sessionStartedAt = Date.now();
  private currentEvents: TimelineEvent[] = [];
  private listeners = new Set<TimelineListener>();
  private databasePromise: Promise<IDBDatabase | null> | null = null;
  private heartbeatTimer: number | null = null;
  private sequence = 0;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        void this.persistSession(Date.now(), true);
      });
    }
  }

  subscribe = (listener: TimelineListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getCurrentEvents = (): readonly TimelineEvent[] => this.currentEvents;

  record(input: TimelineEventInput): TimelineEvent {
    return this.recordMany([input])[0];
  }

  recordMany(inputs: readonly TimelineEventInput[]): TimelineEvent[] {
    if (inputs.length === 0) {
      return [];
    }

    const events = inputs.map<TimelineEvent>((input) => ({
      ...input,
      id: `${this.currentSessionId}:${this.sequence++}`,
      sessionId: this.currentSessionId,
      at: Math.round(input.at),
    }));
    this.currentEvents = [...this.currentEvents, ...events];
    for (const listener of this.listeners) {
      listener();
    }
    this.ensureHeartbeat();
    void this.persistEvents(events);
    return events;
  }

  findLatestCurrentEvent(type: TimelineEventType): TimelineEvent | undefined {
    for (let index = this.currentEvents.length - 1; index >= 0; index -= 1) {
      const event = this.currentEvents[index];
      if (event.type === type) {
        return event;
      }
    }
    return undefined;
  }

  async queryRange(from: number, to: number): Promise<TimelineRange> {
    const memoryEvents = selectMemoryEvents(this.currentEvents, from, to);
    const currentSession: TimelineSession = {
      id: this.currentSessionId,
      startedAt: this.sessionStartedAt,
      lastSeenAt: Date.now(),
    };
    const database = await this.getDatabase();
    if (!database) {
      return {
        events: memoryEvents,
        sessions: [currentSession],
        currentSessionId: this.currentSessionId,
      };
    }

    try {
      const eventTransaction = database.transaction(EVENT_STORE, "readonly");
      const eventTransactionDone = transactionDone(eventTransaction);
      const eventStore = eventTransaction.objectStore(EVENT_STORE);
      const byTime = eventStore.index("at");
      const byTypeAndTime = eventStore.index("typeAt");
      const rangeRequest = byTime.getAll(
        IDBKeyRange.bound(from, to, false, true),
      ) as IDBRequest<TimelineEvent[]>;
      const predecessorRequests = TIMELINE_PREDECESSOR_TYPES.map((type) =>
        this.getLatestBefore(byTypeAndTime, type, from),
      );
      const [storedEvents, predecessors] = await Promise.all([
        requestResult(rangeRequest),
        Promise.all(predecessorRequests),
      ]);
      await eventTransactionDone;

      const sessionTransaction = database.transaction(SESSION_STORE, "readonly");
      const sessionTransactionDone = transactionDone(sessionTransaction);
      const storedSessions = await requestResult(
        sessionTransaction.objectStore(SESSION_STORE).getAll() as IDBRequest<
          TimelineSession[]
        >,
      );
      await sessionTransactionDone;
      const sessions = new Map(storedSessions.map((session) => [session.id, session]));
      sessions.set(this.currentSessionId, currentSession);

      return {
        events: mergeTimelineEvents(
          storedEvents,
          predecessors.filter((event): event is TimelineEvent => Boolean(event)),
          memoryEvents,
        ),
        sessions: [...sessions.values()],
        currentSessionId: this.currentSessionId,
      };
    } catch {
      return {
        events: memoryEvents,
        sessions: [currentSession],
        currentSessionId: this.currentSessionId,
      };
    }
  }

  private getLatestBefore(
    index: IDBIndex,
    type: TimelineEventType,
    before: number,
  ): Promise<TimelineEvent | undefined> {
    const request = index.openCursor(
      IDBKeyRange.bound([type, 0], [type, before], false, true),
      "prev",
    );
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result?.value as TimelineEvent | undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private ensureHeartbeat(): void {
    if (this.heartbeatTimer !== null || typeof window === "undefined") {
      return;
    }
    this.heartbeatTimer = window.setInterval(() => {
      void this.persistSession(Date.now(), false);
    }, SESSION_HEARTBEAT_MS);
  }

  private async getDatabase(): Promise<IDBDatabase | null> {
    if (this.databasePromise) {
      return this.databasePromise;
    }
    if (typeof indexedDB === "undefined") {
      this.databasePromise = Promise.resolve(null);
      return this.databasePromise;
    }

    this.databasePromise = new Promise<IDBDatabase | null>((resolve) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const eventStore = database.createObjectStore(EVENT_STORE, {
          keyPath: "id",
        });
        eventStore.createIndex("at", "at");
        eventStore.createIndex("typeAt", ["type", "at"]);
        eventStore.createIndex("sessionId", "sessionId");
        const sessionStore = database.createObjectStore(SESSION_STORE, {
          keyPath: "id",
        });
        sessionStore.createIndex("lastSeenAt", "lastSeenAt");
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
        void this.prune(database);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return this.databasePromise;
  }

  private async persistEvents(events: readonly TimelineEvent[]): Promise<void> {
    const database = await this.getDatabase();
    if (!database) {
      return;
    }
    try {
      const transaction = database.transaction(
        [EVENT_STORE, SESSION_STORE],
        "readwrite",
      );
      const done = transactionDone(transaction);
      const eventStore = transaction.objectStore(EVENT_STORE);
      for (const event of events) {
        eventStore.put(event);
      }
      transaction.objectStore(SESSION_STORE).put({
        id: this.currentSessionId,
        startedAt: this.sessionStartedAt,
        lastSeenAt: Date.now(),
      } satisfies TimelineSession);
      await done;
    } catch {
      // The current session remains queryable in memory if IndexedDB is unavailable.
    }
  }

  private async persistSession(now: number, ended: boolean): Promise<void> {
    const database = await this.getDatabase();
    if (!database) {
      return;
    }
    try {
      const transaction = database.transaction(SESSION_STORE, "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(SESSION_STORE).put({
        id: this.currentSessionId,
        startedAt: this.sessionStartedAt,
        lastSeenAt: now,
        ...(ended ? { endedAt: now } : {}),
      } satisfies TimelineSession);
      await done;
    } catch {
      // A missed heartbeat can lose at most one checkpoint interval after a crash.
    }
  }

  private async prune(database: IDBDatabase): Promise<void> {
    const cutoff = Date.now() - TIMELINE_RETENTION_DAYS * DAY_MS;
    try {
      const transaction = database.transaction(
        [EVENT_STORE, SESSION_STORE],
        "readwrite",
      );
      const done = transactionDone(transaction);
      const deleteCursorRange = (
        index: IDBIndex,
        range: IDBKeyRange,
      ): Promise<void> =>
        new Promise((resolve, reject) => {
          const request = index.openCursor(range);
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
              resolve();
              return;
            }
            cursor.delete();
            cursor.continue();
          };
          request.onerror = () => reject(request.error);
        });
      await Promise.all([
        deleteCursorRange(
          transaction.objectStore(EVENT_STORE).index("at"),
          IDBKeyRange.upperBound(cutoff, true),
        ),
        deleteCursorRange(
          transaction.objectStore(SESSION_STORE).index("lastSeenAt"),
          IDBKeyRange.upperBound(cutoff, true),
        ),
      ]);
      await done;
    } catch {
      // Retention cleanup is best effort and never blocks new event recording.
    }
  }
}

export const timelineRepository = new TimelineRepository();
