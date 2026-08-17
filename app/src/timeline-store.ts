import {
  TIMELINE_PREDECESSOR_TYPES,
  TIMELINE_RETENTION_DAYS,
  type TimelineEvent,
  type TimelineEventInput,
  type TimelineEventType,
  type TimelineRange,
  type TimelineSession,
  mergeTimelineEvents,
  mergeTimelineSessions,
} from "./timeline";

const DATABASE_NAME = "look-me:timeline:v2";
const LEGACY_DATABASE_NAME = "look-me:timeline:v1";
const DATABASE_VERSION = 1;
const EVENT_STORE = "events";
const SESSION_STORE = "sessions";
const SESSION_HEARTBEAT_MS = 3_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const RETENTION_PRUNE_INTERVAL_MS = 60 * 60 * 1_000;

type TimelineListener = () => void;

export interface TimelineSnapshot {
  events: readonly TimelineEvent[];
  sessions: readonly TimelineSession[];
  activeSessionId: string | null;
}

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

function createSessionId(at: number): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `${Math.round(at)}-${randomPart}`;
}

function selectEvents(
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

function selectSessions(
  sessions: readonly TimelineSession[],
  activeSessionId: string | null,
  from: number,
  to: number,
  events: readonly TimelineEvent[],
): TimelineSession[] {
  const referencedSessionIds = new Set(events.map((event) => event.sessionId));
  return sessions.filter((session) => {
    const endAt =
      session.id === activeSessionId
        ? to
        : (session.endedAt ?? session.lastSeenAt);
    return (
      referencedSessionIds.has(session.id) ||
      (session.startedAt < to && endAt >= from)
    );
  });
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

export class TimelineRepository {
  private snapshot: TimelineSnapshot = {
    events: [],
    sessions: [],
    activeSessionId: null,
  };
  private listeners = new Set<TimelineListener>();
  private databasePromise: Promise<IDBDatabase | null> | null = null;
  private heartbeatTimer: number | null = null;
  private sequence = 0;
  private lastPrunedAt = 0;
  private latestObservedAt: number | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.endSession(this.latestObservedAt ?? Date.now());
      });
    }
  }

  subscribe = (listener: TimelineListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): TimelineSnapshot => this.snapshot;

  startSession(at: number): string {
    const startedAt = Math.round(at);
    this.pruneIfDue(startedAt);
    if (this.snapshot.activeSessionId) {
      this.latestObservedAt = Math.max(
        this.latestObservedAt ?? startedAt,
        startedAt,
      );
      return this.snapshot.activeSessionId;
    }

    const session: TimelineSession = {
      id: createSessionId(startedAt),
      startedAt,
      lastSeenAt: startedAt,
    };
    this.snapshot = {
      ...this.snapshot,
      sessions: [...this.snapshot.sessions, session],
      activeSessionId: session.id,
    };
    this.latestObservedAt = startedAt;
    this.emit();
    this.ensureHeartbeat();
    void this.persistSession(session);
    return session.id;
  }

  endSession(at: number): void {
    const activeSessionId = this.snapshot.activeSessionId;
    if (!activeSessionId) {
      return;
    }

    const latestEventAt = this.snapshot.events.reduce(
      (latestAt, event) =>
        event.sessionId === activeSessionId
          ? Math.max(latestAt, event.at)
          : latestAt,
      Number.NEGATIVE_INFINITY,
    );
    let endedSession: TimelineSession | undefined;
    const sessions = this.snapshot.sessions.map((session) => {
      if (session.id !== activeSessionId) {
        return session;
      }
      const endedAt = Math.max(
        session.startedAt,
        session.lastSeenAt,
        latestEventAt,
        this.latestObservedAt ?? Number.NEGATIVE_INFINITY,
        Math.round(at),
      );
      endedSession = { ...session, lastSeenAt: endedAt, endedAt };
      return endedSession;
    });
    this.snapshot = { ...this.snapshot, sessions, activeSessionId: null };
    this.latestObservedAt = null;
    this.stopHeartbeat();
    this.emit();
    if (endedSession) {
      void this.persistSession(endedSession);
    }
  }

  record(input: TimelineEventInput): TimelineEvent {
    return this.recordMany([input])[0];
  }

  recordMany(inputs: readonly TimelineEventInput[]): TimelineEvent[] {
    if (inputs.length === 0) {
      return [];
    }
    const sessionId = this.snapshot.activeSessionId;
    if (!sessionId) {
      throw new Error("Timeline events require an active collection session");
    }

    const events = inputs.map(
      (input): TimelineEvent =>
        ({
          ...input,
          id: `${sessionId}:${this.sequence++}`,
          sessionId,
          at: Math.round(input.at),
        }) as TimelineEvent,
    );
    this.snapshot = {
      ...this.snapshot,
      events: [...this.snapshot.events, ...events],
    };
    this.emit();
    void this.persistEvents(events);
    return events;
  }

  getCurrentRange(from: number, to: number): TimelineRange {
    const events = selectEvents(this.snapshot.events, from, to);
    return {
      events,
      sessions: selectSessions(
        this.snapshot.sessions,
        this.snapshot.activeSessionId,
        from,
        to,
        events,
      ),
      activeSessionId: this.snapshot.activeSessionId,
    };
  }

  async queryRange(from: number, to: number): Promise<TimelineRange> {
    const currentRange = this.getCurrentRange(from, to);
    const database = await this.getDatabase();
    if (!database) {
      return currentRange;
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
      const sessions = mergeTimelineSessions(storedSessions, currentRange.sessions);

      const events = mergeTimelineEvents(
        storedEvents,
        predecessors.filter((event): event is TimelineEvent => Boolean(event)),
        currentRange.events,
      );
      return {
        events,
        sessions: selectSessions(
          sessions,
          currentRange.activeSessionId,
          from,
          to,
          events,
        ),
        activeSessionId: currentRange.activeSessionId,
      };
    } catch {
      return currentRange;
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
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
      const now = Date.now();
      const activeSession = this.snapshot.sessions.find(
        ({ id }) => id === this.snapshot.activeSessionId,
      );
      if (activeSession) {
        void this.persistSession({
          ...activeSession,
          lastSeenAt: Math.max(
            activeSession.lastSeenAt,
            this.latestObservedAt ?? activeSession.lastSeenAt,
          ),
        });
      }
      this.pruneIfDue(now);
    }, SESSION_HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = null;
  }

  private async getDatabase(): Promise<IDBDatabase | null> {
    if (this.databasePromise) {
      return this.databasePromise;
    }
    if (typeof indexedDB === "undefined") {
      this.databasePromise = Promise.resolve(null);
      return this.databasePromise;
    }

    this.databasePromise = (async () => {
      await deleteDatabase(LEGACY_DATABASE_NAME);
      return new Promise<IDBDatabase | null>((resolve) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          const eventStore = database.createObjectStore(EVENT_STORE, {
            keyPath: "id",
          });
          eventStore.createIndex("at", "at");
          eventStore.createIndex("typeAt", ["type", "at"]);
          const sessionStore = database.createObjectStore(SESSION_STORE, {
            keyPath: "id",
          });
          sessionStore.createIndex("lastSeenAt", "lastSeenAt");
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => database.close();
          resolve(database);
          this.pruneIfDue(Date.now());
        };
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      });
    })();
    return this.databasePromise;
  }

  private async persistEvents(events: readonly TimelineEvent[]): Promise<void> {
    const database = await this.getDatabase();
    if (!database) {
      return;
    }
    try {
      const transaction = database.transaction(EVENT_STORE, "readwrite");
      const done = transactionDone(transaction);
      const eventStore = transaction.objectStore(EVENT_STORE);
      for (const event of events) {
        eventStore.put(event);
      }
      await done;
    } catch {
      // Current-session data remains queryable in memory when persistence is unavailable.
    }
  }

  private async persistSession(session: TimelineSession): Promise<void> {
    const database = await this.getDatabase();
    if (!database) {
      return;
    }
    try {
      const transaction = database.transaction(SESSION_STORE, "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(SESSION_STORE).put(session);
      await done;
    } catch {
      // A missed heartbeat can lose at most one checkpoint interval after a crash.
    }
  }

  private pruneIfDue(at: number): void {
    if (at - this.lastPrunedAt < RETENTION_PRUNE_INTERVAL_MS) {
      return;
    }
    this.lastPrunedAt = at;
    const cutoff = at - TIMELINE_RETENTION_DAYS * DAY_MS;
    const retainedEvents = selectEvents(
      this.snapshot.events,
      cutoff,
      Number.POSITIVE_INFINITY,
    );
    const referencedSessionIds = new Set(
      retainedEvents.map((event) => event.sessionId),
    );
    const retainedSessions = this.snapshot.sessions.filter(
      (session) =>
        session.id === this.snapshot.activeSessionId ||
        session.lastSeenAt >= cutoff ||
        referencedSessionIds.has(session.id),
    );
    if (
      retainedSessions.length !== this.snapshot.sessions.length ||
      retainedEvents.length !== this.snapshot.events.length
    ) {
      this.snapshot = {
        ...this.snapshot,
        sessions: retainedSessions,
        events: retainedEvents,
      };
      this.emit();
    }
    void this.getDatabase().then((database) => {
      if (database) {
        void this.prune(database, at);
      }
    });
  }

  private async prune(database: IDBDatabase, at: number): Promise<void> {
    const cutoff = at - TIMELINE_RETENTION_DAYS * DAY_MS;
    try {
      const readTransaction = database.transaction(
        [EVENT_STORE, SESSION_STORE],
        "readonly",
      );
      const readDone = transactionDone(readTransaction);
      const eventStore = readTransaction.objectStore(EVENT_STORE);
      const sessionStore = readTransaction.objectStore(SESSION_STORE);
      const [predecessors, sessions] = await Promise.all([
        Promise.all(
          TIMELINE_PREDECESSOR_TYPES.map((type) =>
            this.getLatestBefore(eventStore.index("typeAt"), type, cutoff),
          ),
        ),
        requestResult(
          sessionStore.getAll() as IDBRequest<TimelineSession[]>,
        ),
      ]);
      await readDone;

      const retainedPredecessors = predecessors.filter(
        (event): event is TimelineEvent => Boolean(event),
      );
      const retainedEventIds = new Set(
        retainedPredecessors.map((event) => event.id),
      );
      const retainedSessionIds = new Set(
        sessions
          .filter((session) => session.lastSeenAt >= cutoff)
          .map((session) => session.id),
      );
      for (const event of retainedPredecessors) {
        retainedSessionIds.add(event.sessionId);
      }

      const transaction = database.transaction(
        [EVENT_STORE, SESSION_STORE],
        "readwrite",
      );
      const done = transactionDone(transaction);
      const writeEventStore = transaction.objectStore(EVENT_STORE);
      const writeSessionStore = transaction.objectStore(SESSION_STORE);
      const deleteOldEvents = (): Promise<void> =>
        new Promise((resolve, reject) => {
          const request = writeEventStore
            .index("at")
            .openCursor(IDBKeyRange.upperBound(cutoff, true));
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
              resolve();
              return;
            }
            const event = cursor.value as TimelineEvent;
            if (!retainedEventIds.has(event.id)) {
              cursor.delete();
            }
            cursor.continue();
          };
          request.onerror = () => reject(request.error);
        });
      for (const session of sessions) {
        if (!retainedSessionIds.has(session.id)) {
          writeSessionStore.delete(session.id);
        }
      }
      await deleteOldEvents();
      await done;
    } catch {
      // Retention cleanup is best effort and never blocks new event recording.
    }
  }
}

export const timelineRepository = new TimelineRepository();
