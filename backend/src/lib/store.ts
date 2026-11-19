/**
 * Storage interface. One DynamoDB table holds every record:
 *   pk   "LEAD#<id>" | "EST#<id>" | "EVT#<id>" | "SETTINGS" | "COUNTER#<name>"
 *   type "lead" | "estimate" | "event"        (GSI "byType" partition key)
 *   sk   sort key inside a type: createdAt for leads/estimates, start for events
 * At ~15 customers a month a whole type fits in one GSI query for years.
 */
export type RecordType = 'lead' | 'estimate' | 'event';

export interface Store {
  get<T>(pk: string): Promise<T | undefined>;
  put(pk: string, value: object, index?: { type: RecordType; sk: string }): Promise<void>;
  delete(pk: string): Promise<void>;
  /** All records of a type, sorted by sk; optionally only sk in [from, to]. */
  list<T>(type: RecordType, range?: { from: string; to: string }): Promise<T[]>;
  /** Atomically increments and returns a named counter. */
  next(counter: string, start: number): Promise<number>;
}

/** In-memory store for tests and local dev. */
export class MemoryStore implements Store {
  private items = new Map<string, { value: object; type?: RecordType; sk?: string }>();
  private counters = new Map<string, number>();

  async get<T>(pk: string) {
    const it = this.items.get(pk);
    return it ? (structuredClone(it.value) as T) : undefined;
  }
  async put(pk: string, value: object, index?: { type: RecordType; sk: string }) {
    this.items.set(pk, { value: structuredClone(value), type: index?.type, sk: index?.sk });
  }
  async delete(pk: string) {
    this.items.delete(pk);
  }
  async list<T>(type: RecordType, range?: { from: string; to: string }) {
    return [...this.items.values()]
      .filter((i) => i.type === type && (!range || (i.sk! >= range.from && i.sk! <= range.to)))
      .sort((a, b) => (a.sk! < b.sk! ? -1 : a.sk! > b.sk! ? 1 : 0))
      .map((i) => structuredClone(i.value) as T);
  }
  async next(counter: string, start: number) {
    const n = (this.counters.get(counter) ?? start - 1) + 1;
    this.counters.set(counter, n);
    return n;
  }
}
