// @vitest-environment jsdom
import { zipSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'

import { buildGroups, ImportCancelled, looksLikeHeader, orient, pastedName, readFile, readText, textColumns } from './data-import'

const csv = (text: string) => readText(text)

describe('reading a data file into groups', () => {
  it('finds the names in a first row of text over numbers, and groups by column', () => {
    const table = csv('Control,Drug A\n4.1,6.8\n3.9,7.2\n')
    expect(looksLikeHeader(table, 'columns')).toBe(true)
    expect(buildGroups(table, { header: true, orientation: 'columns', leftOut: [] })).toEqual([
      { name: 'Control', values: [4.1, 3.9] },
      { name: 'Drug A', values: [6.8, 7.2] },
    ])
  })

  it('treats an all-number first row as data and names the groups itself', () => {
    const table = csv('1,2\n3,4\n')
    expect(looksLikeHeader(table, 'columns')).toBe(false)
    expect(buildGroups(table, { header: false, orientation: 'columns', leftOut: [] })).toEqual([
      { name: 'Group 1', values: [1, 3] },
      { name: 'Group 2', values: [2, 4] },
    ])
  })

  it('reads groups from rows when asked, with the names in the first column', () => {
    const table = csv('Control,4.1,3.9\nDrug A,6.8,7.2\n')
    expect(looksLikeHeader(table, 'columns')).toBe(false)
    expect(looksLikeHeader(table, 'rows')).toBe(true)
    expect(orient(table, 'rows')[0]).toEqual(['Control', 'Drug A'])
    expect(buildGroups(table, { header: true, orientation: 'rows', leftOut: [] })).toEqual([
      { name: 'Control', values: [4.1, 3.9] },
      { name: 'Drug A', values: [6.8, 7.2] },
    ])
  })

  it('leaves out the columns that are unticked, and starts with the ones holding no numbers left out', () => {
    const table = csv('Control,Drug A,Notes\n4.1,6.8,plate 1\n3.9,7.2,\n')
    expect(textColumns(table, 'columns', true)).toEqual([false, false, true])
    expect(buildGroups(table, { header: true, orientation: 'columns', leftOut: [0, 2] }).map((g) => g.name)).toEqual(['Drug A'])
  })

  it('makes blanks and text cells empty, evens ragged rows and drops empty rows at the end', () => {
    const table = csv('A,B\n1,x\n2\n,\n')
    expect(buildGroups(table, { header: true, orientation: 'columns', leftOut: [] })).toEqual([
      { name: 'A', values: [1, 2] },
      { name: 'B', values: [null, null] },
    ])
  })

  it('reads comma decimals in a semicolon-separated file', () => {
    const table = csv('Kontrolle;Wirkstoff\n1,5;2,25\n1,7;2,5\n')
    expect(table[0]).toEqual(['Kontrolle', 'Wirkstoff'])
    expect(buildGroups(table, { header: true, orientation: 'columns', leftOut: [] })).toEqual([
      { name: 'Kontrolle', values: [1.5, 1.7] },
      { name: 'Wirkstoff', values: [2.25, 2.5] },
    ])
  })

  it('reads tab-separated text such as a block pasted from a spreadsheet', () => {
    expect(csv('a\tb\n1\t2\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('names a pasted data set by its time', () => {
    expect(pastedName(new Date(2026, 10, 20, 9, 5))).toBe('Pasted 20 Nov 09:05')
  })

  it('reads a text file, and stops when cancelled', async () => {
    const file = new File(['Control,Drug\n1,2\n'], 'plate.csv', { type: 'text/csv' })
    const [sheet] = await readFile(file)
    expect(sheet).toEqual({ name: 'plate.csv', rows: [['Control', 'Drug'], ['1', '2']] })
    const controller = new AbortController()
    controller.abort()
    await expect(readFile(file, { signal: controller.signal })).rejects.toBeInstanceOf(ImportCancelled)
  })

  it('reads every sheet of an xlsx file', async () => {
    const xml = (body: string) => strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`)
    const sheet = (rows: string) => xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`)
    const text = (ref: string, value: string) => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`
    const bytes = zipSync({
      '[Content_Types].xml': xml(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      ),
      '_rels/.rels': xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
      'xl/workbook.xml': xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Plate 1" sheetId="1" r:id="rId1"/><sheet name="Plate 2" sheetId="2" r:id="rId2"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'),
      'xl/worksheets/sheet1.xml': sheet(`<row r="1">${text('A1', 'Control')}${text('B1', 'Drug')}</row><row r="2"><c r="A2"><v>4.5</v></c><c r="B2"><v>6</v></c></row>`),
      'xl/worksheets/sheet2.xml': sheet(`<row r="1">${text('A1', 'Other')}</row><row r="2"><c r="A2"><v>1</v></c></row>`),
    })
    const sheets = await readFile(new File([bytes], 'plates.xlsx'))
    expect(sheets.map((s) => s.name)).toEqual(['Plate 1', 'Plate 2'])
    expect(buildGroups(sheets[0]?.rows ?? [], { header: true, orientation: 'columns', leftOut: [] })).toEqual([
      { name: 'Control', values: [4.5] },
      { name: 'Drug', values: [6] },
    ])
  })
})

describe('finding the header row by itself', () => {
  it('turns on for text over numbers, even with a notes column in between', () => {
    expect(looksLikeHeader(csv('Control,Notes,Drug A\n4.1,plate 1,6.8\n3.9,,7.2\n'), 'columns')).toBe(true)
    // Text in the first row of a data column counts even when other cells below are mixed
    expect(looksLikeHeader(csv('Control,Drug A\n4.1,6.8\nn/a,7.2\n'), 'columns')).toBe(true)
  })

  it('turns on for a first row of doses that rises and lies outside the numbers below it', () => {
    const doses = csv('0,1,3,10\n108,86,84,64\n112,92,86,64\n103,93,86,54\n101,82,80,65\n')
    expect(looksLikeHeader(doses, 'columns')).toBe(true)
    // the same idea for groups in rows: the first column holds the doses
    expect(looksLikeHeader(csv('0,108,112,103,101\n1,86,92,93,82\n3,84,86,86,80\n10,64,64,54,65\n'), 'rows')).toBe(true)
  })

  it('stays off for numbers whose first row rises but sits among the others, or does not rise', () => {
    expect(looksLikeHeader(csv('1.1,2.3,4.8\n1.0,2.9,5.2\n1.4,2.2,4.1\n1.6,2.5,4.9\n'), 'columns')).toBe(false)
    expect(looksLikeHeader(csv('10,5,3\n108,86,84\n112,92,86\n103,93,86\n'), 'columns')).toBe(false)
    expect(looksLikeHeader(csv('0,1\n108,86\n112,92\n103,93\n'), 'columns')).toBe(false) // only two columns: too little to tell
  })
})
