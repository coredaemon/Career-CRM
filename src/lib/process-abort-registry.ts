const controllers = new Map<string, AbortController>();

export function createProcessAbortController(processId: string): AbortSignal {
  abortProcess(processId);
  const controller = new AbortController();
  controllers.set(processId, controller);
  return controller.signal;
}

export function getProcessAbortSignal(processId: string): AbortSignal | undefined {
  return controllers.get(processId)?.signal;
}

export function abortProcess(processId: string) {
  const existing = controllers.get(processId);
  if (existing) {
    existing.abort();
    controllers.delete(processId);
  }
}

export function clearProcessAbortController(processId: string) {
  controllers.delete(processId);
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message.includes("aborted");
  }
  return false;
}
