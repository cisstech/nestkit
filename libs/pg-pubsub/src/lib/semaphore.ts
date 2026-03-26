export class Semaphore {
  private current = 0
  private readonly waiting: (() => void)[] = []

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++
      return
    }
    return new Promise<void>((resolve) => this.waiting.push(resolve))
  }

  release(): void {
    this.current--
    const next = this.waiting.shift()
    if (next) {
      this.current++
      next()
    }
  }
}
