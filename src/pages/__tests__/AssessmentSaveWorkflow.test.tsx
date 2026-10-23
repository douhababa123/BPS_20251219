import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import App from '../../App';
import { AssessmentDraftProvider } from '../../contexts/AssessmentDraftContext';
import { getAllAssessments, getAssessmentMatrix, saveAssessmentBatch } from '../../lib/competencyApi';
import type { AssessmentBatchSaveResult } from '../../lib/competencyApi';

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('../../contexts/NewAuthContext', () => ({
  useNewAuth: () => ({ user: { id: 'admin', email: 'admin@example.test' }, isAdmin: true, isLoading: false, logout }),
}));
vi.mock('../../contexts/PersonaContext', () => ({ PersonaProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('../../components/NotificationPanel', () => ({ NotificationBell: () => null }));
vi.mock('../../components/OTPLogin', () => ({ OTPLogin: () => null }));
vi.mock('../../components/SimpleLoginScreen', () => ({ default: () => <div>登录测试页</div> }));
vi.mock('../auth/RegisterPage', () => ({ RegisterPage: () => null }));
vi.mock('../auth/PasswordLoginPage', () => ({ PasswordLoginPage: () => null }));
vi.mock('../auth/ChangePasswordPage', () => ({ ChangePasswordPage: () => null }));
vi.mock('../Dashboard', () => ({ Dashboard: () => <div>总览测试页</div> }));
vi.mock('../Calendar', () => ({ Calendar: () => null }));
vi.mock('../Schedule', () => ({ Schedule: () => null }));
vi.mock('../Matching', () => ({ Matching: () => null }));
vi.mock('../Competency', () => ({ Competency: () => null }));
vi.mock('../Import', () => ({ Import: () => null }));
vi.mock('../ImportNew', () => ({ ImportNew: () => null }));
vi.mock('../Admin', () => ({ Admin: () => null }));
vi.mock('../DatabaseCheck', () => ({ default: () => null }));
vi.mock('../DebugPage', () => ({ default: () => null }));
vi.mock('../../lib/api-client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: [{ module_id: 1, module_name: 'BPS elements' }] }) },
}));
vi.mock('../../lib/competencyApi', () => ({
  averageAssessmentValues: (values: number[]) => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0,
  getAllAssessments: vi.fn(), getAssessmentMatrix: vi.fn(), saveAssessmentBatch: vi.fn(), getCompetencyChangeLog: vi.fn(),
}));

const saved = { versionId: 'saved-version-1', savedCount: 1, savedAt: '2026-10-23T11:00:00' };
let serverTarget = 3;
const routers: ReturnType<typeof createMemoryRouter>[] = [];
function start() {
  const router = createMemoryRouter([
    { path: '*', element: <AssessmentDraftProvider><App /></AssessmentDraftProvider> },
  ], { initialEntries: ['/login', '/'], initialIndex: 1 });
  routers.push(router);
  return { ...render(<RouterProvider router={router} />), router };
}

async function stage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Zhang Fanmin.*编辑能力评估/ }));
  await user.selectOptions(screen.getByLabelText('能力目标'), '4');
  expect(screen.getByText(/此处仅加入待保存修改/)).toBeInTheDocument();
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '加入待保存修改' }));
  expect(screen.getByRole('region', { name: '待保存修改' })).toHaveTextContent('1 项未保存修改');
}

function unloadPrevented() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function destinationButton(name: string) {
  return (name === '总览' ? within(screen.getByRole('navigation')) : screen).getByRole('button', { name });
}

describe('assessment save and unsaved navigation workflow', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    serverTarget = 3;
    vi.mocked(getAllAssessments).mockImplementation(async () => [{
      id: 'assessment-zhang', employee_id: 'zhang', employee_name: 'Zhang Fanmin', employee_code: 'SCh-Zhang',
      department_name: 'SCh', skill_id: 28, skill_name: 'Leading in a BPS Plant', module_id: 1,
      module_name: 'BPS elements', current_level: 3, target_level: serverTarget, gap: serverTarget - 3,
      assessment_year: 2026,
    }] as Awaited<ReturnType<typeof getAllAssessments>>);
    vi.mocked(getAssessmentMatrix).mockImplementation(async () => ({
      rows: [{ employeeId: 'zhang', employeeCode: 'SCh-Zhang', employeeName: 'Zhang Fanmin', departmentName: 'SCh', canEdit: true,
        skills: { 28: { skillId: 28, currentLevel: 3, targetLevel: serverTarget, gap: serverTarget - 3 } } }],
      columns: [{ skillId: 28, moduleId: 1, moduleName: 'BPS elements', skillName: 'Leading in a BPS Plant', displayOrder: 1 }],
      stats: { totalEmployees: 1, totalSkills: 1, totalAssessments: 1, avgCurrentLevel: 3,
        avgTargetLevel: serverTarget, avgGap: serverTarget - 3, totalGapScore: serverTarget - 3 },
      editableModuleIds: null,
    }));
    vi.mocked(saveAssessmentBatch).mockImplementation(async cells => {
      serverTarget = cells[0].target_level;
      return saved;
    });
  });
  afterEach(() => {
    routers.splice(0).forEach(router => router.dispose());
    vi.restoreAllMocks();
  });

  it('persists only on Save All, confirms the version and reads the saved value on remount', async () => {
    const user = userEvent.setup();
    const view = start();
    await stage(user);
    expect(saveAssessmentBatch).not.toHaveBeenCalled();
    expect(serverTarget).toBe(3);
    expect(unloadPrevented()).toBe(true);
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    expect(await screen.findByRole('status')).toHaveTextContent('保存成功：1 项修改已写入数据库');
    expect(screen.getByRole('status')).toHaveTextContent(saved.versionId);
    expect(saveAssessmentBatch).toHaveBeenCalledOnce();
    expect(saveAssessmentBatch).toHaveBeenCalledWith([{
      employee_id: 'zhang', skill_id: 28, current_level: 3, target_level: 4, expected_updated_at: null, notes: undefined,
    }]);
    expect(screen.queryByRole('region', { name: '待保存修改' })).not.toBeInTheDocument();
    expect(unloadPrevented()).toBe(false);
    view.unmount();
    start();
    expect(await screen.findByRole('button', { name: /Zhang Fanmin.*编辑能力评估/ })).toHaveTextContent('3/4');
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('keeps drafts on a failed submission and permits a successful retry', async () => {
    vi.mocked(saveAssessmentBatch).mockRejectedValueOnce(new Error('测试网络失败'));
    const user = userEvent.setup();
    start();
    await stage(user);
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('测试网络失败');
    expect(screen.getByText('1 项未保存修改')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(serverTarget).toBe(3);
    expect(unloadPrevented()).toBe(true);
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    expect(await screen.findByRole('status')).toHaveTextContent(saved.versionId);
    expect(serverTarget).toBe(4);
  });

  it('does not invite resubmission if saving succeeded but the subsequent refresh failed', async () => {
    const user = userEvent.setup();
    start();
    await stage(user);
    vi.mocked(getAssessmentMatrix).mockRejectedValueOnce(new Error('刷新失败'));
    await user.click(screen.getByRole('button', { name: '保存全部修改' }));
    expect(await screen.findByRole('status')).toHaveTextContent('数据已保存，但页面重新加载失败');
    expect(screen.getByText('3/4')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /编辑能力评估/ })).not.toBeInTheDocument();
    expect(screen.queryByText('1 项未保存修改')).not.toBeInTheDocument();
    expect(unloadPrevented()).toBe(false);
    await user.click(screen.getByRole('button', { name: '刷新' }));
    expect(await screen.findByRole('button', { name: /编辑能力评估/ })).toHaveTextContent('3/4');
    expect(saveAssessmentBatch).toHaveBeenCalledOnce();
  });

  it('blocks duplicate submission, edits and leaving while the save is pending', async () => {
    let resolve!: (value: AssessmentBatchSaveResult) => void;
    vi.mocked(saveAssessmentBatch).mockReturnValue(new Promise(done => { resolve = done; }));
    const user = userEvent.setup();
    start();
    await stage(user);
    await user.dblClick(screen.getByRole('button', { name: '保存全部修改' }));
    expect(saveAssessmentBatch).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '放弃修改' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /编辑能力评估/ })).not.toBeInTheDocument();
    await user.click(destinationButton('总览'));
    await user.click(screen.getByRole('button', { name: '卡片' }));
    await user.click(screen.getByRole('button', { name: '刷新' }));
    await user.click(screen.getByRole('button', { name: /admin@example.test/ }));
    await user.click(screen.getByRole('button', { name: '退出登录' }));
    expect(logout).not.toHaveBeenCalled();
    expect(getAssessmentMatrix).toHaveBeenCalledOnce();
    expect(window.alert).toHaveBeenCalledTimes(4);
    expect(unloadPrevented()).toBe(true);
    await act(async () => { serverTarget = 4; resolve(saved); });
    expect(await screen.findByRole('status')).toHaveTextContent(saved.versionId);
  });

  it.each(['卡片', '表格', '刷新', '总览'])('asks before %s and preserves drafts on cancellation', async destination => {
    const user = userEvent.setup();
    start();
    await stage(user);
    await user.click(destinationButton(destination));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(screen.getByText('1 项未保存修改')).toBeInTheDocument();
    expect(getAssessmentMatrix).toHaveBeenCalledOnce();
    vi.mocked(window.confirm).mockReturnValue(true);
    await user.click(destinationButton(destination));
    await waitFor(() => expect(screen.queryByText('1 项未保存修改')).not.toBeInTheDocument());
    expect(saveAssessmentBatch).not.toHaveBeenCalled();
    expect(unloadPrevented()).toBe(false);
  });

  it('requires confirmation before logout without logging out on cancellation', async () => {
    const user = userEvent.setup();
    start();
    await stage(user);
    await user.click(screen.getByRole('button', { name: /admin@example.test/ }));
    await user.click(screen.getByRole('button', { name: '退出登录' }));
    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByText('1 项未保存修改')).toBeInTheDocument();
    vi.mocked(window.confirm).mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: '退出登录' }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('protects un-staged dialog changes on reload and removes the guard when cancelled', async () => {
    const user = userEvent.setup();
    start();
    await user.click(await screen.findByRole('button', { name: /编辑能力评估/ }));
    expect(unloadPrevented()).toBe(false);
    await user.selectOptions(screen.getByLabelText('能力目标'), '4');
    expect(unloadPrevented()).toBe(true);
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(unloadPrevented()).toBe(false);
    await user.click(destinationButton('总览'));
    expect(screen.getByText('总览测试页')).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('guards SPA back navigation and proceeds only after confirmation', async () => {
    const user = userEvent.setup();
    const { router } = start();
    await stage(user);
    await act(async () => { await router.navigate(-1); });
    await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByText('1 项未保存修改')).toBeInTheDocument();
    vi.mocked(window.confirm).mockReturnValue(true);
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByText('登录测试页')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(unloadPrevented()).toBe(false);
  });
});
