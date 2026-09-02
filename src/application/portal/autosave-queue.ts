export type AutosaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";
export type AutosaveHandoff<T> = {
  error: unknown;
  nonRetryable?: boolean;
  value: T;
};

type AutosaveQueueOptions<T> = {
  delay: number;
  maxFlushPasses?: number;
  onStatusChange?: (status: AutosaveStatus, error?: unknown) => void;
  save: (value: T) => Promise<void>;
  shouldRetry?: (error: unknown) => boolean;
};

/**
 * Debounces full snapshots and serializes persistence so an older request can
 * never finish after (and overwrite) a newer one.
 */
export class AutosaveQueue<T> {
  readonly #delay: number;
  readonly #maxFlushPasses: number;
  readonly #onStatusChange?: AutosaveQueueOptions<T>["onStatusChange"];
  readonly #save: AutosaveQueueOptions<T>["save"];
  readonly #shouldRetry: NonNullable<AutosaveQueueOptions<T>["shouldRetry"]>;
  #disposed = false;
  #conflictAcknowledged = false;
  #dueAt = 0;
  #inFlight: Promise<void> | null = null;
  #pending: T | undefined;
  #recovery: T | undefined;
  #status: AutosaveStatus = "idle";
  #terminalError: unknown;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor({
    delay,
    maxFlushPasses = 50,
    onStatusChange,
    save,
    shouldRetry = () => true,
  }: AutosaveQueueOptions<T>) {
    this.#delay = delay;
    this.#maxFlushPasses = maxFlushPasses;
    this.#onStatusChange = onStatusChange;
    this.#save = save;
    this.#shouldRetry = shouldRetry;
  }

  get status() {
    return this.#status;
  }

  schedule(value: T) {
    if (this.#disposed) return;
    if (this.#terminalError !== undefined) {
      this.#recovery = value;
      return;
    }
    this.#pending = value;
    this.#dueAt = Date.now() + this.#delay;
    this.#setStatus("saving");
    this.#arm(this.#delay);
  }

  acceptHandoff({ error, nonRetryable, value }: AutosaveHandoff<T>) {
    if (
      this.#disposed ||
      this.#terminalError !== undefined ||
      this.#pending !== undefined
    )
      return;
    if (nonRetryable) {
      this.#recovery = value;
      this.#terminalError = error;
      this.#setStatus("conflict");
      return;
    }
    this.#pending = value;
    this.#setStatus("error", error);
  }

  completePredecessor(handoff?: AutosaveHandoff<T>) {
    if (handoff) {
      this.acceptHandoff(handoff);
      return;
    }
    if (!this.#disposed && this.#pending === undefined) {
      this.#setStatus("idle");
    }
  }

  async flush() {
    if (this.#disposed) return;
    if (this.#terminalError !== undefined) throw this.#terminalError;
    let passes = 0;
    while (!this.#disposed) {
      this.#clearTimer();
      if (!this.#inFlight && this.#pending === undefined) return;
      if (passes >= this.#maxFlushPasses) {
        const error = new Error("Autosave flush did not stabilize");
        this.#clearTimer();
        this.#setStatus("error", error);
        throw error;
      }
      const operation = this.#inFlight ?? this.#drain();
      passes += 1;
      await operation;
      if (this.#terminalError !== undefined) throw this.#terminalError;
    }
  }

  acknowledgeNonRetryableError() {
    if (this.#terminalError === undefined) return false;
    this.#conflictAcknowledged = true;
    return true;
  }

  retryRecovery() {
    if (
      this.#terminalError === undefined ||
      !this.#conflictAcknowledged ||
      this.#recovery === undefined
    ) {
      return false;
    }
    const recovery = this.#recovery;
    this.#recovery = undefined;
    this.#terminalError = undefined;
    this.#conflictAcknowledged = false;
    this.schedule(recovery);
    return recovery;
  }

  async dispose(): Promise<AutosaveHandoff<T> | undefined> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#clearTimer();
    let finalError: unknown;
    try {
      if (this.#inFlight) await this.#inFlight;
    } catch (error) {
      finalError = error;
      // The failed snapshot remains pending and gets one final safe attempt.
    }
    if (this.#pending !== undefined) {
      try {
        await this.#drain(true);
      } catch (error) {
        finalError = error;
      }
    }
    if (this.#recovery !== undefined) {
      const value = this.#recovery;
      this.#recovery = undefined;
      return {
        error:
          this.#terminalError ??
          finalError ??
          new Error("Autosave conflict requires reconciliation"),
        nonRetryable: true,
        value,
      };
    }
    if (this.#pending === undefined) return;
    const value = this.#pending;
    this.#pending = undefined;
    return {
      error: finalError ?? new Error("Autosave dispose could not persist"),
      value,
    };
  }

  #arm(delay: number) {
    this.#clearTimer();
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#drain().catch(() => {
        // The error is exposed through status and retained for explicit retry.
      });
    }, delay);
  }

  #clearTimer() {
    if (!this.#timer) return;
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #drain(whileDisposing = false) {
    if ((!whileDisposing && this.#disposed) || this.#pending === undefined) {
      return Promise.resolve();
    }
    if (this.#inFlight) return this.#inFlight;

    const value = this.#pending;
    this.#pending = undefined;
    this.#setStatus("saving");

    const operation = (async () => {
      let restoredFailedSnapshot = false;
      try {
        await this.#save(value);
        this.#setStatus(this.#pending === undefined ? "saved" : "saving");
      } catch (error) {
        const retryable = this.#shouldRetry(error);
        if (!retryable) {
          this.#recovery = this.#pending ?? value;
          this.#pending = undefined;
          this.#terminalError = error;
          this.#conflictAcknowledged = false;
        }
        if (retryable && this.#pending === undefined) {
          this.#pending = value;
          restoredFailedSnapshot = true;
        }
        this.#setStatus(
          retryable ? "error" : "conflict",
          retryable ? error : undefined,
        );
        throw error;
      } finally {
        this.#inFlight = null;
        if (
          !this.#disposed &&
          this.#pending !== undefined &&
          !restoredFailedSnapshot
        ) {
          this.#arm(Math.max(0, this.#dueAt - Date.now()));
        }
      }
    })();
    this.#inFlight = operation;
    return operation;
  }

  #setStatus(status: AutosaveStatus, error?: unknown) {
    this.#status = status;
    if (!this.#disposed) this.#onStatusChange?.(status, error);
  }
}
