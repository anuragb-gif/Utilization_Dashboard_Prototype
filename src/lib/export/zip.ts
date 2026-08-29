/**
 * Minimal ZIP writer (STORE method, no compression).
 *
 * An .xlsx file is a ZIP of XML parts. Rather than pull in a spreadsheet
 * library - and the bundle weight and CVE surface that comes with it - the
 * prototype writes the container itself. Stored (uncompressed) entries are
 * valid ZIP and open in Excel, LibreOffice and Numbers.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  path: string
  content: string
}

/**
 * DOS timestamp. Fixed rather than "now" so an export of unchanged data is
 * byte-identical, which makes the output diffable in a test.
 */
const DOS_TIME = 0x9c00 // 19:32:00
const DOS_DATE = 0x5c9b // 2026-04-27

export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  for (const entry of entries) {
    const nameEncoded = encoder.encode(entry.path)
    const nameBytes = new Uint8Array(new ArrayBuffer(nameEncoded.length))
    nameBytes.set(nameEncoded)
    const encoded = encoder.encode(entry.content)
    const dataBytes = new Uint8Array(new ArrayBuffer(encoded.length))
    dataBytes.set(encoded)
    const crc = crc32(dataBytes)

    const local = new Uint8Array(new ArrayBuffer(30 + nameBytes.length))
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true) // local file header signature
    localView.setUint16(4, 20, true) // version needed
    localView.setUint16(6, 0x0800, true) // UTF-8 filename flag
    localView.setUint16(8, 0, true) // method: stored
    localView.setUint16(10, DOS_TIME, true)
    localView.setUint16(12, DOS_DATE, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, dataBytes.length, true)
    localView.setUint32(22, dataBytes.length, true)
    localView.setUint16(26, nameBytes.length, true)
    localView.setUint16(28, 0, true)
    local.set(nameBytes, 30)

    chunks.push(local, dataBytes)

    const dir = new Uint8Array(new ArrayBuffer(46 + nameBytes.length))
    const dirView = new DataView(dir.buffer)
    dirView.setUint32(0, 0x02014b50, true) // central directory signature
    dirView.setUint16(4, 20, true)
    dirView.setUint16(6, 20, true)
    dirView.setUint16(8, 0x0800, true)
    dirView.setUint16(10, 0, true)
    dirView.setUint16(12, DOS_TIME, true)
    dirView.setUint16(14, DOS_DATE, true)
    dirView.setUint32(16, crc, true)
    dirView.setUint32(20, dataBytes.length, true)
    dirView.setUint32(24, dataBytes.length, true)
    dirView.setUint16(28, nameBytes.length, true)
    dirView.setUint32(42, offset, true)
    dir.set(nameBytes, 46)
    central.push(dir)

    offset += local.length + dataBytes.length
  }

  const centralSize = central.reduce((sum, c) => sum + c.length, 0)
  const end = new Uint8Array(new ArrayBuffer(22))
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true) // end of central directory
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)

  return new Blob([...chunks, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
