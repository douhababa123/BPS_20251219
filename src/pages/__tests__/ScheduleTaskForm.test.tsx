import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskFormModal } from '../Schedule';

vi.mock('../../contexts/NewAuthContext', () => ({
  useNewAuth: () => ({ user: { id: 'admin', email: 'admin@bosch.com', role: 'admin' } }),
}));

vi.mock('../../services', () => ({
  tasksService: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), getTasks: vi.fn() },
  employeesService: { getAll: vi.fn() },
  scheduleNotificationsService: { create: vi.fn() },
  taskTypesService: { getAll: vi.fn().mockResolvedValue([]) },
  competencyDefinitionsService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/task-workflow.service', () => ({
  taskWorkflowService: {},
}));

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TaskFormModal
        employees={[]}
        editingTask={null}
        prefilledData={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onUpdate={vi.fn()}
      />
    </QueryClientProvider>
  );
}

function selectUnder(label: string): HTMLSelectElement {
  const labelNode = screen.getByText(label, { exact: false });
  const select = labelNode.parentElement?.querySelector('select');
  if (!select) throw new Error(`No select found under ${label}`);
  return select;
}

describe('schedule task form', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers Supplier instead of GPU-SU and makes status optional', () => {
    renderForm();
    const location = selectUnder('任务地点');
    const status = selectUnder('任务状态（可选）');

    expect(Array.from(location.options).map((option) => option.value)).toContain('Supplier');
    expect(Array.from(location.options).map((option) => option.value)).not.toContain('GPU-SU');
    expect(status).not.toBeRequired();
    expect(status.value).toBe('');
  });

  it('locks irrelevant fields and keeps dates/time editable in Leave mode', () => {
    renderForm();
    fireEvent.change(selectUnder('任务类型'), { target: { value: 'Leave' } });

    expect(screen.getByPlaceholderText('输入任务名称')).toHaveValue('Leave');
    expect(screen.getByPlaceholderText('输入任务名称')).toBeDisabled();
    expect(selectUnder('任务地点')).toHaveValue('out of office');
    expect(selectUnder('任务地点')).toBeDisabled();
    expect(selectUnder('能力域 Competence')).toBeDisabled();
    expect(selectUnder('分配工程师')).toBeDisabled();
    expect(selectUnder('任务状态（可选）')).toBeDisabled();

    const dateInputs = screen.getAllByDisplayValue('')
      .filter((element): element is HTMLInputElement => element instanceof HTMLInputElement && element.type === 'date');
    expect(dateInputs).toHaveLength(2);
    dateInputs.forEach((input) => expect(input).not.toBeDisabled());
    expect(screen.getByText('上午', { exact: true }).closest('button')).not.toBeDisabled();
  });
});
