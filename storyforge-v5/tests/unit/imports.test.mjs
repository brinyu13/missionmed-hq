import assert from 'node:assert/strict';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { previewImport } from '../../server/imports.mjs';

const existingQuestions = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    text: 'Tell me about a time you advocated for someone whose needs were not being heard.',
  },
];

test('paste preview flags exact duplicates, near duplicates, empty rows, and formulas', async () => {
  const rows = await previewImport({
    format: 'paste',
    text: [
      existingQuestions[0].text,
      'Tell me about a time you advocated for someone whose needs were not heard.',
      '=HYPERLINK("https://example.test","bad")',
      '-2+3',
      '',
      'How did you adapt when a plan changed? | Behavioral',
    ].join('\n'),
    existingQuestions,
  });
  assert.equal(rows[0].exactDuplicateId, existingQuestions[0].id);
  assert.equal(rows[0].selected, false);
  assert.equal(rows[1].nearDuplicateId, existingQuestions[0].id);
  assert.equal(rows[2].formulaLike, true);
  assert.match(rows[2].safeExportText, /^'/);
  assert.equal(rows[3].formulaLike, true);
  assert.match(rows[3].safeExportText, /^'/);
  assert.ok(rows[4].error);
  assert.equal(rows[5].selected, true);
  assert.equal(rows[5].family, 'behavioral');
});

test('XLSX preview reads question and family columns as data only', async () => {
  const files = {
    '[Content_Types].xml': `<?xml version="1.0"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
        <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
      </Types>`,
    '_rels/.rels': `<?xml version="1.0"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
      </Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets><sheet name="Questions" sheetId="1" r:id="rId1"/></sheets>
      </workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
      </Relationships>`,
    'xl/styles.xml': `<?xml version="1.0"?>
      <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders>
        <cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf/></cellXfs>
      </styleSheet>`,
    'xl/sharedStrings.xml': `<?xml version="1.0"?>
      <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"></sst>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1"><c r="A1" t="inlineStr"><is><t>Question</t></is></c><c r="B1" t="inlineStr"><is><t>Family</t></is></c></row>
          <row r="2"><c r="A2" t="inlineStr"><is><t>What did you learn from a difficult decision?</t></is></c><c r="B2" t="inlineStr"><is><t>growth</t></is></c></row>
        </sheetData>
      </worksheet>`,
  };
  const archive = zipSync(Object.fromEntries(
    Object.entries(files).map(([name, content]) => [name, strToU8(content)]),
  ));
  const dataBase64 = Buffer.from(archive).toString('base64');
  const rows = await previewImport({ format: 'xlsx', dataBase64, existingQuestions: [] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].family, 'core');
  assert.equal(rows[0].selected, true);
});

test('XLSX preview rejects a highly compressed expansion before workbook parsing', async () => {
  const archive = zipSync({
    'xl/worksheets/sheet1.xml': strToU8('A'.repeat(1_000_000)),
  }, { level: 9 });
  assert.ok(archive.byteLength < 5 * 1024 * 1024);

  await assert.rejects(
    previewImport({
      format: 'xlsx',
      dataBase64: Buffer.from(archive).toString('base64'),
      existingQuestions: [],
    }),
    (error) => error.code === 'import_too_large',
  );
});

test('unsupported formats and oversize row sets fail closed', async () => {
  await assert.rejects(
    previewImport({ format: 'pdf', text: 'not parsed', existingQuestions: [] }),
    (error) => error.code === 'unsupported_import_format',
  );
  const overLimit = Array.from({ length: 5001 }, (_, index) => `Question ${index}?`).join('\n');
  await assert.rejects(
    previewImport({ format: 'paste', text: overLimit, existingQuestions: [] }),
    (error) => error.code === 'too_many_import_rows',
  );
});
