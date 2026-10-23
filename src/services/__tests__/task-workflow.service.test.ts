import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../lib/api-client';
import { taskWorkflowService } from '../task-workflow.service';

vi.mock('../../lib/api-client', () => ({ apiClient: { post: vi.fn().mockResolvedValue({ data: {} }) } }));

describe('approval version snapshots', () => {
  it('sends the displayed version when approving', async () => {
    await taskWorkflowService.approve('task-1', 3);
    expect(apiClient.post).toHaveBeenLastCalledWith('/tasks/task-1/approve', { expected_version: 3 });
  });
  it('sends the captured dialog version and reason when rejecting', async () => {
    await taskWorkflowService.reject('task-1', 'Unavailable', 4);
    expect(apiClient.post).toHaveBeenLastCalledWith('/tasks/task-1/reject', {
      expected_version: 4, rejection_reason: 'Unavailable',
    });
  });
});
