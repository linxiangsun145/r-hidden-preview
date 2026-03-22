export interface DebouncedExecutor {
  run(task: () => void): void;
  cancel(): void;
  updateWait(ms: number): void;
}

export function createDebouncedExecutor(initialWaitMs: number): DebouncedExecutor {
  let waitMs = initialWaitMs;
  let timer: NodeJS.Timeout | undefined;

  return {
    run(task: () => void): void {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        task();
      }, waitMs);
    },
    cancel(): void {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    updateWait(ms: number): void {
      waitMs = ms;
    }
  };
}
