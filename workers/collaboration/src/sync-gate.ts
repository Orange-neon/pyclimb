/**
 * A y-partyserver document is intentionally empty whenever its Durable Object
 * isolate starts or wakes. It is safe to serve runs only after a provider has
 * answered the server's sync-step-1 with sync-step-2 (subtype 1).
 */
export class DocumentSyncGate {
  #ready = false;
  #expectedResponders = new Set<string>();
  #responded = new Set<string>();

  get ready(): boolean {
    return this.#ready;
  }

  resetForStart(expectedResponders: Iterable<string> = []): void {
    this.#ready = false;
    this.#expectedResponders = new Set(expectedResponders);
    this.#responded.clear();
  }

  expectResponder(connectionId: string): void {
    if (!this.#ready) this.#expectedResponders.add(connectionId);
  }

  observeSyncSubtype(connectionId: string, subtype: number | null): boolean {
    if (subtype !== 1 || this.#ready || !this.#expectedResponders.has(connectionId)) return false;
    this.#responded.add(connectionId);
    return this.#openIfComplete();
  }

  removeResponder(connectionId: string): boolean {
    if (this.#ready) return false;
    this.#expectedResponders.delete(connectionId);
    this.#responded.delete(connectionId);
    return this.#openIfComplete();
  }

  #openIfComplete(): boolean {
    if (this.#expectedResponders.size === 0) return false;
    for (const connectionId of this.#expectedResponders) {
      if (!this.#responded.has(connectionId)) return false;
    }
    this.#ready = true;
    return true;
  }
}
