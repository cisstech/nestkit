export interface LockOptions {
  /**
   * The key to lock on
   */
  key: string

  /**
   * The duration of the lock in milliseconds
   */
  duration: number

  /**
   * Callback to execute when the lock is acquired
   */
  onAccept: () => Promise<void> | void

  /**
   * Optional callback to execute when the lock is rejected
   */
  onReject?: () => Promise<void> | void
}

/**
 * Interface for lock services used by PgPubSub
 */
export interface LockService {
  /**
   * Try to acquire a lock and execute a callback if successful
   */
  tryLock(options: LockOptions): Promise<void>
}
