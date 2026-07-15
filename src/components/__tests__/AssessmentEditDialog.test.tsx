import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import AssessmentEditDialog from '../AssessmentEditDialog';


describe('AssessmentEditDialog', () => {
  it('offers only target values at or above the selected current value', async () => {
    const user = userEvent.setup();
    render(
      <AssessmentEditDialog
        employeeName="Xue Ting"
        skillName="WAS"
        onCancel={() => undefined}
        onSave={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText('能力现状'), '3');

    const target = screen.getByLabelText('能力目标');
    const optionValues = within(target)
      .getAllByRole('option')
      .map(option => (option as HTMLOptionElement).value);
    expect(optionValues).toEqual(['', '3', '4']);
    expect(screen.queryByRole('option', { name: '5' })).not.toBeInTheDocument();
  });

  it('clears an invalid target when current is raised', async () => {
    const user = userEvent.setup();
    render(
      <AssessmentEditDialog
        employeeName="Xue Ting"
        skillName="WAS"
        initial={{ current_level: 2, target_level: 3, notes: '' }}
        onCancel={() => undefined}
        onSave={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText('能力现状'), '4');

    expect(screen.getByText('请重新选择不低于现状的能力目标')).toBeInTheDocument();
    expect(screen.getByLabelText('能力目标')).toHaveValue('');
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('submits zero as valid assessed data and prevents duplicate submission', async () => {
    const user = userEvent.setup();
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn(() => new Promise<void>(resolve => {
      resolveSave = resolve;
    }));
    render(
      <AssessmentEditDialog
        employeeName="Xue Ting"
        skillName="WAS"
        onCancel={() => undefined}
        onSave={onSave}
      />,
    );

    await user.selectOptions(screen.getByLabelText('能力现状'), '0');
    await user.selectOptions(screen.getByLabelText('能力目标'), '2');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(onSave).toHaveBeenCalledWith({
      current_level: 0,
      target_level: 2,
      notes: undefined,
    });
    expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled();
    await act(async () => {
      resolveSave?.();
    });
  });

  it('retains entered values and shows a server error', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('只能修改本人的能力评估'));
    render(
      <AssessmentEditDialog
        employeeName="Xue Ting"
        skillName="WAS"
        onCancel={() => undefined}
        onSave={onSave}
      />,
    );

    await user.selectOptions(screen.getByLabelText('能力现状'), '0');
    await user.selectOptions(screen.getByLabelText('能力目标'), '2');
    await user.type(screen.getByLabelText('备注'), 'Q3 update');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('只能修改本人的能力评估')).toBeInTheDocument();
    expect(screen.getByLabelText('能力现状')).toHaveValue('0');
    expect(screen.getByLabelText('能力目标')).toHaveValue('2');
    expect(screen.getByLabelText('备注')).toHaveValue('Q3 update');
  });
});
