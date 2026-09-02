export type BufferedAction = 'light' | 'heavy' | 'jump';

interface Slot {
  action: BufferedAction;
  expiresAt: number;
}

/** Short-window input buffer so next-hit / jump inputs during animation still register. */
export class ComboBuffer {
  private slot: Slot | null = null;
  private readonly windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  push(action: BufferedAction, now: number): void {
    this.slot = { action, expiresAt: now + this.windowMs };
  }

  consume(now: number, allowed: BufferedAction[]): BufferedAction | null {
    if (!this.slot) {
      return null;
    }
    if (now > this.slot.expiresAt) {
      this.slot = null;
      return null;
    }
    if (!allowed.includes(this.slot.action)) {
      return null;
    }
    const action = this.slot.action;
    this.slot = null;
    return action;
  }

  peek(now: number): BufferedAction | null {
    if (!this.slot || now > this.slot.expiresAt) {
      this.slot = null;
      return null;
    }
    return this.slot.action;
  }

  clear(): void {
    this.slot = null;
  }
}
