import { Semaphore } from '../semaphore'

describe('Semaphore', () => {
  it('should allow up to max concurrent acquisitions', async () => {
    const sem = new Semaphore(2)

    await sem.acquire()
    await sem.acquire()

    let thirdAcquired = false
    const p = sem.acquire().then(() => {
      thirdAcquired = true
    })

    // Third acquire should be waiting
    await new Promise((r) => setTimeout(r, 10))
    expect(thirdAcquired).toBe(false)

    sem.release()
    await p
    expect(thirdAcquired).toBe(true)

    sem.release()
    sem.release()
  })

  it('should process waiters in FIFO order', async () => {
    const sem = new Semaphore(1)
    const order: number[] = []

    await sem.acquire()

    const p1 = sem.acquire().then(() => order.push(1))
    const p2 = sem.acquire().then(() => order.push(2))

    sem.release()
    await p1

    sem.release()
    await p2

    expect(order).toEqual([1, 2])

    sem.release()
  })

  it('should handle release without waiters', () => {
    const sem = new Semaphore(3)
    // Release without acquire should not throw
    sem.release()
  })
})
