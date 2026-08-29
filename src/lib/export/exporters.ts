'use client'

/**
 * Export helpers.
 *
 * Every export button in the application goes through here, so a CSV and an
 * XLSX of the same table always contain the same rows in the same order -
 * including the "N/A" markers, which are exported as text rather than as
 * empty cells so a missing value stays visibly missing in Excel.
 */

import { createZip } from './zip'

export type CellValue = string | number | null

export interface ExportColumn<T> {
  key: string
  header: string
  value: (row: T) => CellValue
}

export interface ExportMeta {
  title: string
  reportDate: string
  generatedAt: string
  filters?: string
}

const NA_TEXT = 'N/A'

function toCsvCell(value: CellValue): string {
  if (value === null) return NA_TEXT
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function exportCsv<T>(rows: T[], columns: ExportColumn<T>[], meta: ExportMeta) {
  const preamble = [
    `# ${meta.title}`,
    `# Snowman Logistics - Pan-India Utilization Control Tower (PROTOTYPE - DEMONSTRATION DATA)`,
    `# Report date: ${meta.reportDate}`,
    `# Generated: ${meta.generatedAt}`,
    meta.filters ? `# Filters: ${meta.filters}` : '# Filters: none',
    '',
  ].join('\n')

  const header = columns.map((c) => toCsvCell(c.header)).join(',')
  const body = rows.map((row) => columns.map((c) => toCsvCell(c.value(row))).join(',')).join('\n')

  download(new Blob([`${preamble}${header}\n${body}\n`], { type: 'text/csv;charset=utf-8' }), `${slugify(meta.title)}-${meta.reportDate}.csv`)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function columnName(index: number): string {
  let name = ''
  let n = index
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name
    n = Math.floor(n / 26) - 1
  }
  return name
}

function sheetXml(rows: CellValue[][]): string {
  const body = rows
    .map((cells, rowIndex) => {
      const rowNumber = rowIndex + 1
      const xmlCells = cells
        .map((cell, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowNumber}`
          if (cell === null) {
            return `<c r="${ref}" t="inlineStr"><is><t>${NA_TEXT}</t></is></c>`
          }
          if (typeof cell === 'number' && Number.isFinite(cell)) {
            return `<c r="${ref}"><v>${cell}</v></c>`
          }
          // Header rows and text use the bold style defined in styles.xml.
          const style = rowIndex === 0 ? ' s="1"' : ''
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(String(cell))}</t></is></c>`
        })
        .join('')
      return `<row r="${rowNumber}">${xmlCells}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

export function exportXlsx<T>(rows: T[], columns: ExportColumn<T>[], meta: ExportMeta) {
  const dataRows: CellValue[][] = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => c.value(row))),
  ]

  const infoRows: CellValue[][] = [
    ['Report', meta.title],
    ['System', 'Snowman Logistics - Pan-India Utilization Control Tower'],
    ['Status', 'PROTOTYPE - DEMONSTRATION DATA, not for operational use'],
    ['Report date', meta.reportDate],
    ['Generated', meta.generatedAt],
    ['Filters', meta.filters ?? 'none'],
    ['Rows', rows.length],
  ]

  const zip = createZip([
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="Report info" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { path: 'xl/styles.xml', content: STYLES_XML },
    { path: 'xl/worksheets/sheet1.xml', content: sheetXml(dataRows) },
    { path: 'xl/worksheets/sheet2.xml', content: sheetXml(infoRows) },
  ])

  download(zip, `${slugify(meta.title)}-${meta.reportDate}.xlsx`)
}

/**
 * PDF export.
 *
 * The prototype produces a PDF through the browser's own print pipeline
 * against the A4-landscape print stylesheet, rather than pretending to have a
 * server-side renderer. It is a real, working export.
 */
export function exportPdf(printHref?: string) {
  if (printHref && window.location.pathname !== printHref) {
    window.open(printHref, '_blank', 'noopener')
    return
  }
  window.print()
}
