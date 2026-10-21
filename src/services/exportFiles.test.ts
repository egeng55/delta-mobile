import { blobToBytes, shareExport } from './exportFiles';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
jest.mock('expo-file-system', () => ({ Paths: { cache: 'fixture-cache' }, File: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
const originalReader = global.FileReader;
afterEach(() => { global.FileReader = originalReader; jest.useRealTimers(); });
test('converts native Blob via FileReader, without Blob.arrayBuffer', async () => {
  class Reader {
    result = new Uint8Array([37, 80, 68, 70]).buffer;
    onload = () => {};
    readAsArrayBuffer() { this.onload(); }
  }
  Object.defineProperty(global, 'FileReader', { configurable: true, writable: true, value: Reader });
  expect(Array.from(await blobToBytes({} as Blob))).toEqual([37, 80, 68, 70]);
});
test('bounds a stalled FileReader conversion', async () => {
  jest.useFakeTimers();
  class Reader { abort() {} readAsArrayBuffer() {} }
  Object.defineProperty(global, 'FileReader', { configurable: true, writable: true, value: Reader });
  const result = expect(blobToBytes({} as Blob)).rejects.toThrow('timed out');
  await jest.advanceTimersByTimeAsync(30000); await result;
});
test.each([false, true])('cleans the temporary export after sharing (failure=%s)', async failure => {
  const file = { uri: 'fixture://export', exists: true, write: jest.fn(), delete: jest.fn() };
  (File as unknown as jest.Mock).mockReturnValue(file);
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  (Sharing.shareAsync as jest.Mock).mockImplementation(async () => { if (failure) throw new Error('Share failed'); });
  const result = shareExport('export.json', '{}', 'application/json');
  if (failure) await expect(result).rejects.toThrow('Share failed'); else await result;
  expect(file.write).toHaveBeenCalledWith('{}');
  expect(file.delete).toHaveBeenCalledTimes(1);
});
test('unavailable sharing does not write sensitive export files', async () => {
  (File as unknown as jest.Mock).mockClear();
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
  await expect(shareExport('export.json', '{}', 'application/json')).rejects.toThrow('unavailable');
  expect(File).not.toHaveBeenCalled();
});
