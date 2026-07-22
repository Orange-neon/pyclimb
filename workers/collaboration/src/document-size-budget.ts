/**
 * Tracks a conservative approximation of the canonical Yjs document size.
 * Exact measurement is still required periodically and whenever an update
 * approaches the configured guard band.
 */
export class DocumentSizeBudget {
  private estimatedBytes = 0;
  private updatesSinceExact = 0;

  constructor(
    private readonly maximumBytes: number,
    private readonly exactEvery = 32,
    private readonly guardBytes = 64 * 1024,
  ) {
    if (maximumBytes <= 0 || exactEvery <= 0 || guardBytes < 0) {
      throw new RangeError("Document size budget values must be positive");
    }
  }

  get estimate(): number {
    return this.estimatedBytes;
  }

  get pendingUpdates(): number {
    return this.updatesSinceExact;
  }

  reset(exactBytes: number): void {
    this.estimatedBytes = Math.max(0, exactBytes);
    this.updatesSinceExact = 0;
  }

  needsExactMeasurement(incomingUpdateBytes: number): boolean {
    const incoming = Math.max(0, incomingUpdateBytes);
    return (
      this.updatesSinceExact + 1 >= this.exactEvery ||
      this.estimatedBytes + incoming > Math.max(0, this.maximumBytes - this.guardBytes)
    );
  }

  recordEstimatedUpdate(incomingUpdateBytes: number): void {
    this.estimatedBytes += Math.max(0, incomingUpdateBytes);
    this.updatesSinceExact += 1;
  }

  recordExactMeasurement(exactBytes: number): void {
    this.reset(exactBytes);
  }
}
