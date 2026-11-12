/** Store already compressed media as-is in a ZIP, without copying each entire file into an ArrayBuffer. */
const CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  return n >>> 0;
});

async function checksum(blob: Blob, signal?: AbortSignal): Promise<number> {
  let crc = 0xffffffff;
  const reader = blob.stream().getReader();
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) return (crc ^ 0xffffffff) >>> 0;
      for (const byte of value) crc = (crc >>> 8) ^ CRC[(crc ^ byte) & 255];
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

function record(size: number, signature: number) {
  const data = new ArrayBuffer(size);
  const view = new DataView(data);
  view.setUint32(0, signature, true);
  return {
    data,
    u16: (at: number, value: number) => view.setUint16(at, value, true),
    u32: (at: number, value: number) => view.setUint32(at, value, true),
  };
}

export class AttachmentZip {
  private files: BlobPart[] = [];
  private directory: BlobPart[] = [];
  private offset = 0;
  private directorySize = 0;

  async add(name: string, blob: Blob, signal?: AbortSignal): Promise<void> {
    const filename = new TextEncoder().encode(name);
    const crc = await checksum(blob, signal);
    const local = record(30, 0x04034b50);
    const central = record(46, 0x02014b50);
    local.u16(4, 20);
    central.u16(4, 20);
    central.u16(6, 20);
    local.u16(6, 0x800); // UTF-8 filename
    central.u16(8, 0x800);
    local.u16(12, 33); // 1980-01-01, the earliest valid DOS date
    central.u16(14, 33);
    local.u32(14, crc);
    central.u32(16, crc);
    local.u32(18, blob.size);
    local.u32(22, blob.size);
    central.u32(20, blob.size);
    central.u32(24, blob.size);
    local.u16(26, filename.length);
    central.u16(28, filename.length);
    central.u32(42, this.offset);
    this.files.push(local.data, filename, blob);
    this.directory.push(central.data, filename);
    this.offset += 30 + filename.length + blob.size;
    this.directorySize += 46 + filename.length;
  }

  finish(): Blob {
    const end = record(22, 0x06054b50);
    const count = this.directory.length / 2;
    end.u16(8, count);
    end.u16(10, count);
    end.u32(12, this.directorySize);
    end.u32(16, this.offset);
    return new Blob([...this.files, ...this.directory, end.data], { type: "application/zip" });
  }
}
