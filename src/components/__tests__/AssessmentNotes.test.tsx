import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatrixView from '../MatrixView';

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [{ module_id: 1, module_name: 'BPS elements' }] }),
  },
}));

const makeRows = (notes: string | null) => [{
  employeeId: 'employee-1', employeeCode: 'E1', employeeName: '测试员工',
  departmentName: '测试', canEdit: true,
  skills: { 1: { skillId: 1, currentLevel: 1, targetLevel: 3, gap: 2, notes } },
}];
const columns = [{ skillId: 1, moduleId: 1, moduleName: 'BPS elements', skillName: '测试技能', displayOrder: 1 }];
const stats = { totalEmployees: 1, totalSkills: 1, totalAssessments: 1, avgCurrentLevel: 1, avgTargetLevel: 3, avgGap: 2, totalGapScore: 2 };
const result = { versionId: 'version-1', savedCount: 1, savedAt: '2026-11-06' };

describe('assessment notes persistence', () => {
  it('saves a notes-only edit and restores it from freshly loaded matrix data', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(result);
    const view = render(<MatrixView rows={makeRows(null)} columns={columns} stats={stats} editableModuleIds={null} onSaveAssessments={save} />);
    await user.click(screen.getByRole('button', { name: /编辑能力评估/ }));
    await user.type(screen.getByLabelText('备注'), '仅更新备注\n中文说明');
    await user.click(screen.getByRole('button', { name: '加入待保存修改' }));
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    expect(save).toHaveBeenCalledWith([expect.objectContaining({
      current_level: 1, target_level: 3, notes: '仅更新备注\n中文说明',
    })]);

    view.unmount();
    render(<MatrixView rows={makeRows(save.mock.calls[0][0][0].notes)} columns={columns} stats={stats} editableModuleIds={null} onSaveAssessments={save} />);
    await user.click(screen.getByRole('button', { name: /编辑能力评估/ }));
    expect(screen.getByLabelText('备注')).toHaveValue('仅更新备注\n中文说明');
  });

  it('preserves a staged note when reopening and staging the same cell again', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(result);
    render(<MatrixView rows={makeRows(null)} columns={columns} stats={stats} editableModuleIds={null} onSaveAssessments={save} />);
    await user.click(screen.getByRole('button', { name: /编辑能力评估/ }));
    await user.type(screen.getByLabelText('备注'), '待保存备注');
    await user.click(screen.getByRole('button', { name: '加入待保存修改' }));
    await user.click(screen.getByRole('button', { name: /编辑能力评估/ }));
    expect(screen.getByLabelText('备注')).toHaveValue('待保存备注');
    await user.click(screen.getByRole('button', { name: '加入待保存修改' }));
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    expect(save).toHaveBeenCalledWith([expect.objectContaining({ notes: '待保存备注' })]);
  });

  it('preserves saved notes when only a score is edited', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(result);
    render(<MatrixView rows={makeRows('原有备注')} columns={columns} stats={stats} editableModuleIds={null} onSaveAssessments={save} />);
    await user.click(screen.getByRole('button', { name: /编辑能力评估/ }));
    expect(screen.getByLabelText('备注')).toHaveValue('原有备注');
    await user.selectOptions(screen.getByLabelText('能力现状'), '2');
    await user.click(screen.getByRole('button', { name: '加入待保存修改' }));
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    expect(save).toHaveBeenCalledWith([expect.objectContaining({ current_level: 2, notes: '原有备注' })]);
  });

  it('keeps an intentionally cleared draft empty instead of restoring the saved note', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(result);
    render(<MatrixView rows={makeRows('原有备注')} columns={columns} stats={stats} editableModuleIds={null} onSaveAssessments={save} />);
    await user.click(screen.getByRole('button', { name: /编辑能力评估/ }));
    expect(screen.getByLabelText('备注')).toHaveValue('原有备注');
    await user.clear(screen.getByLabelText('备注'));
    await user.click(screen.getByRole('button', { name: '加入待保存修改' }));
    await user.click(screen.getByRole('button', { name: /编辑能力评估/ }));
    expect(screen.getByLabelText('备注')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: '加入待保存修改' }));
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    expect(save).toHaveBeenCalledWith([expect.objectContaining({ notes: undefined })]);
  });

  it('keeps the note available to retry after a failed save', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValueOnce(new Error('保存失败')).mockResolvedValue(result);
    render(<MatrixView rows={makeRows(null)} columns={columns} stats={stats} editableModuleIds={null} onSaveAssessments={save} />);
    await user.click(screen.getByRole('button', { name: /编辑能力评估/ }));
    await user.type(screen.getByLabelText('备注'), '重试备注');
    await user.click(screen.getByRole('button', { name: '加入待保存修改' }));
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    await screen.findByText('保存失败');
    await user.click(screen.getByRole('button', { name: /编辑能力评估/ }));
    expect(screen.getByLabelText('备注')).toHaveValue('重试备注');
    await user.click(screen.getByRole('button', { name: '加入待保存修改' }));
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    expect(save).toHaveBeenLastCalledWith([expect.objectContaining({ notes: '重试备注' })]);
  });
});
