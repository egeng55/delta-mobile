import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export function blobToBytes(blob: Blob): Promise<Uint8Array> {
  // React Native Blob supports FileReader, not Blob.arrayBuffer().
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const finish = () => clearTimeout(timer);
    const timer = setTimeout(() => {
      reader.abort();
      reject(new Error('Export conversion timed out'));
    }, 30000);
    reader.onload = () => {
      finish();
      if (!(reader.result instanceof ArrayBuffer)) return reject(new Error('Invalid export contents'));
      resolve(new Uint8Array(reader.result));
    };
    reader.onerror = () => { finish(); reject(new Error('Could not read export')); };
    reader.onabort = () => { finish(); reject(new Error('Export conversion cancelled')); };
    try { reader.readAsArrayBuffer(blob); } catch { finish(); reject(new Error('Could not read export')); }
  });
}

export async function shareExport(name: string, contents: string | Uint8Array, mimeType: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device');
  const file = new File(Paths.cache, name);
  try {
    file.write(contents);
    await Sharing.shareAsync(file.uri, { mimeType });
  } finally {
    // Exported health data must not accumulate in the application cache.
    if (file.exists) file.delete();
  }
}
