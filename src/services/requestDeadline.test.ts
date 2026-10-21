import { withRequestDeadline } from './requestDeadline';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('deadline rejects a transport that never settles and aborts it', async () => {
  let signal: AbortSignal | undefined;
  const result = withRequestDeadline(100, value => { signal = value; return new Promise(() => {}); });
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await jest.advanceTimersByTimeAsync(100);
  await assertion;
  expect(signal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('caller cancellation rejects and removes the deadline', async () => {
  const controller = new AbortController();
  const result = withRequestDeadline(1000, () => new Promise(() => {}), controller.signal);
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await assertion;
  expect(jest.getTimerCount()).toBe(0);
});

test('already cancelled request never starts work', async () => {
  const controller = new AbortController(); controller.abort();
  const work = jest.fn();
  await expect(withRequestDeadline(1000, work, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(work).not.toHaveBeenCalled();
});

test('successful body consumption clears its deadline', async () => {
  await expect(withRequestDeadline(100, async () => 'complete')).resolves.toBe('complete');
  expect(jest.getTimerCount()).toBe(0);
});
