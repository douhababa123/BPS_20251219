import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseComplexExcel } from '../complexExcelParser';
import { parseSkillDefinition } from '../skillDefinitionParser';

function workbookData() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['编号', '模块', '类型', '工程师'],
    [1, 'BPS elements', '标准化作业', 'Example Engineer'],
  ]), '能力定义');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

describe('vendored SheetJS compatibility', () => {
  it('uses the reviewed package version and preserves zero values and Chinese text', () => {
    expect(XLSX.version).toBe('0.20.3');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['技能', '现状', '目标'], ['标准化作业', 0, 4],
    ]), '评估');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const restored = XLSX.read(bytes, { type: 'array' });
    expect(XLSX.utils.sheet_to_json(restored.Sheets['评估'], { header: 1 })).toEqual([
      ['技能', '现状', '目标'], ['标准化作业', 0, 4],
    ]);
  });

  it.each([[0, 4], [4, 2], [0, 0]])('parses matrix current/target %s/%s without changing scores', async (current, target) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Competencies'], [], [], [],
      ['', '', 'BPS Basic'],
      ['Department', 'Name', 'C', 'T'],
      ['Example Department', 'Example Engineer', current, target],
    ]), 'Matrix');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([bytes], 'competencies.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes });
    const result = await parseComplexExcel(file);
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data?.assessments).toHaveLength(1);
    expect(result.data?.assessments[0]).toMatchObject({ current_level: current, target_level: target });
  });

  it.each([[5, 4], [2, 5], [-1, 4], [1.5, 4], ['2junk', 4]])('rejects invalid matrix scores %s/%s', async (current, target) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Competencies'], [], [], [], ['', '', 'BPS Basic'],
      ['Department', 'Name', 'C', 'T'],
      ['Example Department', 'Example Engineer', current, target],
    ]), 'Matrix');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([bytes], 'invalid.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes });
    const result = await parseComplexExcel(file);
    expect(result.success).toBe(false);
    expect(result.data?.assessments).toEqual([]);
    expect(result.errors[0].message).toContain('0-4');
  });

  it('parses the existing array-buffer skill import', async () => {
    const bytes = workbookData();
    const file = new File([bytes], 'skills.xlsx');
    // jsdom File does not implement arrayBuffer; supply browser-equivalent bytes.
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes });
    const result = await parseSkillDefinition(file);
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.skills[0]).toMatchObject({ module_id: 1, skill_name: '标准化作业' });
  });
});
