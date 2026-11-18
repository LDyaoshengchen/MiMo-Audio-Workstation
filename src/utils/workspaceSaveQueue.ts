type SaveResult = { updatedAt: string };
type Snapshot = Record<string, unknown>;
type PendingSave = {
  snapshot: Snapshot;
  send: (body: Snapshot) => Promise<SaveResult>;
  promise: Promise<SaveResult>;
};

/** 每张画板最多保留一次正在写入的保存和一份最新待写入快照。 */
export class WorkspaceSaveQueue {
  private queues = new Map<string, PendingSave>();
  private pending = new Map<string, PendingSave>();
  private versions = new Map<string, string>();
  private failures = new Map<string, Record<string, unknown>>();
  async save<T extends { updatedAt: string }>(id: string, snapshot: Record<string, unknown>, send: (body: Record<string, unknown>) => Promise<T>): Promise<T> {
    const captured = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
    const queued = this.pending.get(id);
    if (queued) {
      queued.snapshot = captured;
      queued.send = send;
      return queued.promise as Promise<T>;
    }

    const previous = this.queues.get(id);
    const start = previous ? previous.promise.catch(() => undefined) : Promise.resolve();
    const operation = start.then(async () => {
      if (this.pending.get(id) === job) this.pending.delete(id);
      const body = job.snapshot;
      try {
        const result = await job.send({ ...body, baseUpdatedAt: this.versions.get(id) || body.baseUpdatedAt });
        this.versions.set(id, result.updatedAt);
        this.failures.delete(id);
        return result;
      } catch (error) {
        this.failures.set(id, body);
        throw error;
      } finally {
        if (this.queues.get(id) === job) this.queues.delete(id);
      }
    });
    const job: PendingSave = { snapshot: captured, send, promise: operation };
    if (previous) this.pending.set(id, job);
    this.queues.set(id, job);
    return operation as Promise<T>;
  }
  hasPending(id: string) { return this.queues.has(id); }
  getFailedSnapshots() { return Array.from(this.failures, ([id, snapshot]) => ({ id, ...snapshot })); }
  seed(id: string, version: string) { if (!this.hasPending(id)) this.versions.set(id, version); }
}
