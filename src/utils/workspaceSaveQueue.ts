/** 每个画板按快照产生顺序保存；后续请求使用上次成功保存返回的版本。 */
export class WorkspaceSaveQueue {
  private queues = new Map<string, Promise<unknown>>();
  private versions = new Map<string, string>();
  private failures = new Map<string, Record<string, unknown>>();
  async save<T extends { updatedAt: string }>(id: string, snapshot: Record<string, unknown>, send: (body: Record<string, unknown>) => Promise<T>): Promise<T> {
    const previous = this.queues.get(id) || Promise.resolve();
    const captured = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
    const operation = previous.catch(() => undefined).then(async () => {
      const result = await send({ ...captured, baseUpdatedAt: this.versions.get(id) || captured.baseUpdatedAt });
      this.versions.set(id, result.updatedAt);
      this.failures.delete(id);
      return result;
    });
    this.queues.set(id, operation);
    try { return await operation; }
    catch (error) { this.failures.set(id, captured); throw error; }
    finally { if (this.queues.get(id) === operation) this.queues.delete(id); }
  }
  hasPending(id: string) { return this.queues.has(id); }
  getFailedSnapshots() { return Array.from(this.failures, ([id, snapshot]) => ({ id, ...snapshot })); }
  seed(id: string, version: string) { if (!this.hasPending(id)) this.versions.set(id, version); }
}
