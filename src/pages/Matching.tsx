import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { matchingApi } from '../lib/matchingApi';
import { TASK_TYPES, LOCATIONS, ROLES, ROLE_THRESHOLDS } from '../lib/constants';
import { taskTypesService } from '../services';
import { taskWorkflowService } from '../services/task-workflow.service';
import { useNewAuth } from '../contexts/NewAuthContext';
import type { MatchingRequest, MatchingCandidate } from '../lib/types';
import { cn } from '../lib/utils';
import { Plus, Trash2, Search, AlertCircle, CheckCircle, X, MapPin, GitMerge, ClipboardList, CalendarCheck, ArrowRight, Sparkles, LayoutGrid, Clock } from 'lucide-react';

const matchingSchema = z.object({
  name: z.string().min(1, 'Required'),
  role: z.enum(['Lead', 'Expert', 'Member', 'Coach']),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
  type: z.string().min(1, 'Required'),
  location: z.string().min(1, 'Required'),
  topic: z.string().min(1, 'Required'),
  moduleId: z.string().min(1, 'Required'),
  suggestedUserId: z.number().optional(),
});

export function Matching() {
  const queryClient = useQueryClient();
  const { user } = useNewAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'matching' | 'kanban'>('matching');
  const [requiredItems, setRequiredItems] = useState<Array<{ itemId: number; requiredLevel: number; isKey: boolean }>>([]);
  const [candidates, setCandidates] = useState<MatchingCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<MatchingCandidate | null>(null);
  const [explainDrawerOpen, setExplainDrawerOpen] = useState(false);
  const [currentTaskInfo, setCurrentTaskInfo] = useState<any>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null); // 内联确认中的候选人 userId
  const [_lastSubmittedStatus, setLastSubmittedStatus] = useState<'pending_approval' | 'planned' | null>(null);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    taskId: string;
    taskName: string;
    employeeName: string;
    status: 'pending_approval' | 'planned';
  } | null>(null);

  const focusSubmittedFeedback = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pushTaskIntoHistory = (data: {
    taskId: string;
    taskName: string;
    taskType: string;
    location: string;
    employeeId: string;
    employeeName: string;
    startDate: string;
    endDate: string;
    status: 'pending_approval' | 'planned';
  }) => {
    queryClient.setQueryData(['matching-history'], (old: any) => {
      const previous = Array.isArray(old) ? old : [];
      const withoutCurrent = previous.filter((item: any) => item.id !== data.taskId);

      return [
        {
          id: data.taskId,
          taskName: data.taskName,
          taskType: data.taskType,
          location: data.location,
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          startDate: data.startDate,
          endDate: data.endDate,
          createdAt: new Date().toISOString(),
          status: data.status,
          rejectionReason: null,
          requesterName: user?.email || '',
        },
        ...withoutCurrent,
      ];
    });
  };

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(matchingSchema),
    defaultValues: {
      role: 'Lead' as const,
      type: 'P',
      location: 'FDCCh',
      topic: '',
      moduleId: '',
    },
  });

  const moduleId = watch('moduleId');

  const { data: modules } = useQuery({
    queryKey: ['matching-modules'],
    queryFn: matchingApi.getModules,
  });

  const { data: taskTypes = [] } = useQuery({
    queryKey: ['task-types'],
    queryFn: () => taskTypesService.getAll(),
  });

  const { data: items } = useQuery({
    queryKey: ['matching-skills', moduleId],
    queryFn: () => matchingApi.getSkills(moduleId ? Number(moduleId) : undefined),
    enabled: !!moduleId,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      // 获取员工列表作为用户列表
      const response = await fetch('http://localhost:8000/api/employees');
      const employees = await response.json();
      return employees.map((emp: any) => ({
        id: emp.id,
        name: emp.employee_name || emp.name,
        dept: emp.department_name || 'Unknown',
        homeLocation: emp.factory_name || 'Unknown'
      }));
    },
  });

  // 获取匹配历史记录（任务看板）
  const { data: matchingHistory = [] } = useQuery({
    queryKey: ['matching-history'],
    queryFn: () => matchingApi.getMatchingHistory(50),
    // refetchInterval: 30000, // 每30秒刷新 - 暂时禁用以避免干扰后端
  });

  // 调试：打印匹配历史数据
  useEffect(() => {
    console.log('🔍 [TaskKanban] matchingHistory 数据变化:', matchingHistory);
  }, [matchingHistory]);

  useEffect(() => {
    if (modules && modules.length > 0 && !moduleId) {
      setValue('moduleId', String(modules[0].id));
    }
  }, [modules, moduleId, setValue]);

  // taskTypes 加载完成后自动选中第一个（防止 topic 为空导致表单静默失败）
  const topicValue = watch('topic');
  useEffect(() => {
    const active = taskTypes.filter(t => t.is_active);
    if (active.length > 0 && !topicValue) {
      setValue('topic', active[0].code);
    }
  }, [taskTypes, topicValue, setValue]);

  const previewMutation = useMutation({
    mutationFn: (data: MatchingRequest) => matchingApi.previewMatching(data),
    onSuccess: (data) => {
      setCandidates(data);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: { candidate: MatchingCandidate; taskInfo: any }) => {
      return taskWorkflowService.assign({
        taskName: data.taskInfo.name,
        employeeId: String(data.candidate.userId),
        taskType: data.taskInfo.type,
        location: data.taskInfo.location,
        startDate: data.taskInfo.startDate,
        endDate: data.taskInfo.endDate,
        notes: `通过智能匹配系统分配 (综合评分: ${(data.candidate.finalScore * 100).toFixed(0)}%)`
      });
    },
    onSuccess: (response, variables) => {
      console.log('✅ [提交成功] 正在刷新任务看板数据...');
      setLastSubmittedStatus('pending_approval');
      setSubmissionFeedback({
        taskId: response.taskId,
        taskName: variables.taskInfo.name,
        employeeName: variables.candidate.name,
        status: 'pending_approval',
      });
      pushTaskIntoHistory({
        taskId: response.taskId,
        taskName: variables.taskInfo.name,
        taskType: variables.taskInfo.type,
        location: variables.taskInfo.location,
        employeeId: String(variables.candidate.userId),
        employeeName: variables.candidate.name,
        startDate: variables.taskInfo.startDate,
        endDate: variables.taskInfo.endDate,
        status: 'pending_approval',
      });
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: ['matching-history'] });
      console.log('✅ [提交成功] 缓存已失效，切换到看板标签...');
      setActiveTab('kanban');
      focusSubmittedFeedback();
      console.log('✅ [提交成功] 已切换到看板标签');
    },
  });

  const forceAssignMutation = useMutation({
    mutationFn: (data: { candidate: MatchingCandidate; taskInfo: any }) => {
      return taskWorkflowService.forceAssign({
        taskName: data.taskInfo.name,
        employeeId: String(data.candidate.userId),
        taskType: data.taskInfo.type,
        location: data.taskInfo.location,
        startDate: data.taskInfo.startDate,
        endDate: data.taskInfo.endDate,
        notes: `强制指派(智能匹配系统) (综合评分: ${(data.candidate.finalScore * 100).toFixed(0)}%)`
      });
    },
    onSuccess: (response, variables) => {
      setLastSubmittedStatus('planned');
      setSubmissionFeedback({
        taskId: response.taskId,
        taskName: variables.taskInfo.name,
        employeeName: variables.candidate.name,
        status: 'planned',
      });
      pushTaskIntoHistory({
        taskId: response.taskId,
        taskName: variables.taskInfo.name,
        taskType: variables.taskInfo.type,
        location: variables.taskInfo.location,
        employeeId: String(variables.candidate.userId),
        employeeName: variables.candidate.name,
        startDate: variables.taskInfo.startDate,
        endDate: variables.taskInfo.endDate,
        status: 'planned',
      });
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: ['matching-history'] });
      setActiveTab('kanban');
      focusSubmittedFeedback();
    },
  });

  // 兼容旧引用（工作流状态计算用）
  const assignMutation = { isPending: submitMutation.isPending || forceAssignMutation.isPending };

  useEffect(() => {
    if (!items) return;
    setRequiredItems(prev => prev.filter(req => {
      const item = items.find(i => i.id === req.itemId);
      if (!moduleId) return true;
      return item?.moduleId === Number(moduleId);
    }));
  }, [items, moduleId]);

  const availableItems = useMemo(() => {
    if (!items) return [];
    if (!moduleId) return items;
    return items.filter(item => item.moduleId === Number(moduleId));
  }, [items, moduleId]);

  const { moduleName } = useMemo(() => {
    if (!moduleId) return { moduleName: '未选择' };
    const module = modules?.find(m => m.id === Number(moduleId));
    return { moduleName: module?.name || '未选择' };
  }, [moduleId, modules]);

  const onPreview = (formData: any) => {
    if (requiredItems.length === 0) {
      alert('请至少添加一个能力要求 Please add at least one competency requirement');
      return;
    }

    const request: MatchingRequest = {
      ...formData,
      moduleId: Number(formData.moduleId),
      required: requiredItems,
      suggestedUserId: formData.suggestedUserId,
    };

    // 保存当前任务信息，用于后续分配
    setCurrentTaskInfo(request);

    previewMutation.mutate(request);
  };

  const addRequiredItem = () => {
    const pickItems = availableItems.length > 0 ? availableItems : items;
    if (pickItems && pickItems.length > 0) {
      setRequiredItems(prev => [...prev, { itemId: pickItems[0].id, requiredLevel: 3, isKey: pickItems[0].isKeyDefault }]);
    }
  };

  const removeRequiredItem = (index: number) => {
    setRequiredItems(requiredItems.filter((_, i) => i !== index));
  };

  const updateRequiredItem = (index: number, field: string, value: any) => {
    const updated = [...requiredItems];
    updated[index] = { ...updated[index], [field]: value };
    setRequiredItems(updated);
  };

  const getRoleGateColor = (gate: string) => {
    if (gate === 'OK') return 'bg-green-50 text-green-700 border border-green-200';
    if (gate === 'LEAD_LOW') return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-red-50 text-red-700 border border-red-200';
  };

  const getRoleGateIcon = (gate: string) => {
    if (gate === 'OK') return CheckCircle;
    return AlertCircle;
  };

  const matchingSummary = useMemo(() => {
    if (candidates.length === 0) {
      return {
        avgSkill: 0,
        avgTime: 0,
        topScore: 0,
      };
    }
    const avgSkill = candidates.reduce((sum, candidate) => sum + candidate.skillScore, 0) / candidates.length;
    const avgTime = candidates.reduce((sum, candidate) => sum + candidate.timeScore, 0) / candidates.length;
    const topScore = candidates[0]?.finalScore || 0;
    return {
      avgSkill: Math.round(avgSkill * 100),
      avgTime: Math.round(avgTime * 100),
      topScore: Math.round(topScore * 100),
    };
  }, [candidates]);

  const qualifiedCandidates = useMemo(() => candidates.filter(candidate => candidate.qualified), [candidates]);
  const hasQualifiedCandidate = qualifiedCandidates.length > 0;
  const fallbackRecommendations = useMemo(
    () => (hasQualifiedCandidate ? [] : candidates.slice(0, 3)),
    [hasQualifiedCandidate, candidates]
  );

  const workflowSteps = useMemo(() => {
    const hasPreview = candidates.length > 0;
    // 审批步骤：强制指派直接完成；普通提交后等待审批中
    const approveStatus = forceAssignMutation.isSuccess
      ? 'done' as const
      : submitMutation.isSuccess
        ? 'processing' as const  // 待 admin 审批中
        : assignMutation.isPending ? 'processing' as const : 'pending' as const;
    // 日程同步：只有强制指派才算真正写入；普通提交审批通过后由 admin 操作
    const syncStatus = forceAssignMutation.isSuccess ? 'done' as const : 'pending' as const;
    return [
      { key: 'apply', label: '任务申请', desc: '需求方提交需求', status: 'done' as const, icon: ClipboardList },
      { key: 'match', label: '智能匹配', desc: '系统打分推荐', status: previewMutation.isPending ? 'processing' as const : hasPreview ? 'done' as const : 'pending' as const, icon: GitMerge },
      { key: 'approve', label: '任务审批', desc: submitMutation.isSuccess ? '等待 Site PS 审批中...' : 'Site PS 审批', status: approveStatus, icon: CheckCircle },
      { key: 'sync', label: '日程同步', desc: submitMutation.isSuccess ? '审批通过后自动写入' : '自动写入日历', status: syncStatus, icon: CalendarCheck },
    ];
  }, [candidates.length, previewMutation.isPending, submitMutation.isSuccess, forceAssignMutation.isSuccess, assignMutation.isPending]);

  const topReport = useMemo(() => candidates.slice(0, 3).map(candidate => ({
    name: candidate.name,
    dept: candidate.dept,
    finalScore: Math.round(candidate.finalScore * 100),
    skillScore: Math.round(candidate.skillScore * 100),
    timeScore: Math.round(candidate.timeScore * 100),
  })), [candidates]);

  return (
    <div className="space-y-6">
      {submissionFeedback && (
        <div className={cn(
          'rounded-2xl border px-5 py-4 flex items-start justify-between gap-4',
          submissionFeedback.status === 'pending_approval'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-green-50 border-green-200 text-green-800'
        )}>
          <div>
            <p className="text-sm font-bold">
              {submissionFeedback.status === 'pending_approval' ? '任务申请已提交，当前状态：待审批' : '任务已直接写入日程，当前状态：待确认'}
            </p>
            <p className="text-sm mt-1">
              {submissionFeedback.taskName} {'->'} {submissionFeedback.employeeName}
            </p>
            <p className="text-xs mt-1 opacity-80">任务编号: {submissionFeedback.taskId}</p>
            <p className="text-xs mt-2 font-medium">
              {submissionFeedback.status === 'pending_approval'
                ? '下一步：等待 Site PS 审批，审批通过后申请人和工程师都会收到通知。'
                : '下一步：等待工程师在日程管理中确认接受。'}
            </p>
          </div>
          <button
            onClick={() => setSubmissionFeedback(null)}
            className="text-xs px-3 py-1 rounded-lg border border-current/20 hover:bg-white/40 transition-colors"
          >
            关闭
          </button>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="bg-white rounded-2xl p-2 border border-gray-100 shadow-sm flex gap-2">
        <button
          onClick={() => setActiveTab('matching')}
          className={cn(
            'flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
            activeTab === 'matching'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Sparkles className="w-4 h-4" />
          智能匹配 Smart Matching
        </button>
        <button
          onClick={() => setActiveTab('kanban')}
          className={cn(
            'flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
            activeTab === 'kanban'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          任务看板 Task Board
        </button>
      </div>

      {/* 智能匹配视图 */}
      {activeTab === 'matching' && (
        <>
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">线上流程状态 Workflow Overview</h2>
        <div className="grid grid-cols-4 gap-4">
          {workflowSteps.map(step => {
            const Icon = step.icon;
            const statusColor = step.status === 'done' ? 'bg-green-100 text-green-700 border-green-200' : step.status === 'processing' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200';
            return (
              <div key={step.key} className={cn('rounded-xl border px-4 py-3 flex flex-col gap-2 transition-colors', statusColor)}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{step.label}</span>
                </div>
                <p className="text-xs leading-relaxed">{step.desc}</p>
                <div className="text-xs font-medium">{step.status === 'done' ? '已完成' : step.status === 'processing' ? '进行中' : '待启动'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-6 h-[calc(100vh-240px)]">
        <div className="col-span-1 space-y-6 overflow-y-auto pr-2">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">任务信息 Task Information</h3>
              <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{moduleName}</span>
            </div>
            <form onSubmit={handleSubmit(onPreview)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  任务名称 Task Name
                </label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., L24 HC Optimization"
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    角色 Role
                  </label>
                  <select {...register('role')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    {ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    能力模块 Module
                  </label>
                  <select
                    {...register('moduleId')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {modules?.map(module => (
                      <option key={module.id} value={module.id}>{module.name}</option>
                    ))}
                  </select>
                  {errors.moduleId && <p className="text-xs text-red-600 mt-1">请选择能力模块</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    任务类型 Type
                  </label>
                  <select {...register('type')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    {TASK_TYPES.map(type => (
                      <option key={type.code} value={type.code}>{type.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    地点 Location
                  </label>
                  <select {...register('location')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    {LOCATIONS.map(loc => (
                      <option key={loc.code} value={loc.code}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    开始日期 Start Date
                  </label>
                  <input
                    type="date"
                    {...register('startDate')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.startDate && <p className="text-xs text-red-600 mt-1">请选择日期</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    结束日期 End Date
                  </label>
                  <input
                    type="date"
                    {...register('endDate')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.endDate && <p className="text-xs text-red-600 mt-1">请选择日期</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  主题 Topic
                </label>
                <select
                  {...register('topic')}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.topic ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择...</option>
                  {taskTypes.filter(t => t.is_active).map(t => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </select>
                {errors.topic && <p className="text-xs text-red-600 mt-1">请选择主题</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  建议人选 Suggested User (Optional)
                </label>
                <select
                  {...register('suggestedUserId', { setValueAs: v => v ? parseInt(v, 10) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">无 None</option>
                  {users?.map((user: { id: number; name: string }) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    能力要求 Competency Requirements
                  </label>
                  <button
                    type="button"
                    onClick={addRequiredItem}
                    className="flex items-center gap-1 text-sm text-blue-900 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    添加 Add
                  </button>
                </div>

                <div className="space-y-2">
                  {requiredItems.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                      {/* 第一行：技能名称（截断）+ 删除按钮（固定宽度，始终可见） */}
                      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 28px' }}>
                        <select
                          value={item.itemId}
                          onChange={(e) => updateRequiredItem(index, 'itemId', parseInt(e.target.value, 10))}
                          className="w-full min-w-0 px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          {availableItems.map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeRequiredItem(index)}
                          className="flex items-center justify-center p-1 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {/* 第二行：要求等级 + 关键项 */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 flex-shrink-0">要求等级</span>
                        <select
                          value={item.requiredLevel}
                          onChange={(e) => updateRequiredItem(index, 'requiredLevel', parseInt(e.target.value, 10))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          {[1, 2, 3, 4, 5].map(level => (
                            <option key={level} value={level}>L{level}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.isKey}
                            onChange={(e) => updateRequiredItem(index, 'isKey', e.target.checked)}
                            className="rounded"
                          />
                          关键项 Key
                        </label>
                      </div>
                    </div>
                  ))}
                  {requiredItems.length === 0 && (
                    <p className="text-xs text-gray-500">请选择模块后，添加关键能力项</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={previewMutation.isPending}
                className="w-full py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {previewMutation.isPending ? '匹配中... Matching...' : '预览匹配 Preview Match'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-3">匹配洞察 Matching Insights</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-700" />
                <span>平均技能匹配 {matchingSummary.avgSkill}% · 平均时间匹配 {matchingSummary.avgTime}%</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-600" />
                <span>最佳候选综合得分 {matchingSummary.topScore}%</span>
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                系统按照「0.5×能力匹配 + 0.5×可用时间率」计算综合得分，并对关键项自动加权。合格标准：能力匹配 ≥70% 且 时间可用率 ≥50%。
              </div>
              <div
                className={cn(
                  'mt-2 rounded-xl border px-3 py-3 text-sm font-medium',
                  hasQualifiedCandidate
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                )}
              >
                {hasQualifiedCandidate ? (
                  <div className="space-y-2">
                    <p>系统已识别 {qualifiedCandidates.length} 位符合条件（能力 ≥70% 且 时间 ≥50%）的合适人选。</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {qualifiedCandidates.slice(0, 4).map(candidate => (
                        <span key={candidate.userId} className="px-2 py-1 bg-white/70 rounded-full">
                          {candidate.name} · {Math.round(candidate.finalScore * 100)}%
                        </span>
                      ))}
                      {qualifiedCandidates.length > 4 && (
                        <span className="px-2 py-1 bg-white/70 rounded-full">+{qualifiedCandidates.length - 4}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p>暂未找到符合条件（能力 ≥70% 且 时间 ≥50%）的人选，以下候选作为 Top3 推荐供 Site PS 参考。</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {fallbackRecommendations.map(candidate => (
                        <span key={candidate.userId} className="px-2 py-1 bg-white/70 rounded-full">
                          {candidate.name} · {Math.round(candidate.finalScore * 100)}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">候选人排序 Ranked Candidates</h3>
                <p className="text-sm text-gray-600 mt-1">按综合评分排序 Sorted by final score</p>
              </div>
              {candidates.length > 0 && (
                <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  Top {candidates.length}
                </div>
              )}
            </div>

            {candidates.length === 0 ? (
              <div className="text-center py-16">
                <Search className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">点击"预览匹配"查看候选人</p>
                <p className="text-sm text-gray-400">Click "Preview Match" to see candidates</p>
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map((candidate, idx) => {
                  const GateIcon = getRoleGateIcon(candidate.roleGate);
                  const isTop = idx === 0;
                  const isSuggested = candidate.badges.includes('suggested');

                  return (
                    <div
                      key={candidate.userId}
                      className={cn(
                        'rounded-xl border-2 transition-all hover:shadow-md',
                        isTop ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300' : 'bg-white border-gray-200 hover:border-blue-300'
                      )}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-900 text-white text-xs font-bold">
                              {idx + 1}
                            </div>
                            <h4 className="font-bold text-gray-900 text-lg">{candidate.name}</h4>
                            {isSuggested && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                建议人选
                              </span>
                            )}
                            {candidate.qualified && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                合适人选
                              </span>
                            )}
                            {!candidate.qualified && !hasQualifiedCandidate && idx < 3 && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                推荐
                              </span>
                            )}
                          </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                              <MapPin className="w-4 h-4" />
                              <span>{candidate.dept}</span>
                              <span>•</span>
                              <span>{candidate.homeLocation}</span>
                            </div>
                          </div>
                          <div className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border', getRoleGateColor(candidate.roleGate))}>
                            <GateIcon className="w-3 h-3" />
                            {candidate.roleGate === 'OK' ? '✓ 符合' : '⚠ 需提升'}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 mb-4">
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-600 mb-1">技能评分</p>
                            <p className="text-xl font-bold text-blue-900">{(candidate.skillScore * 100).toFixed(0)}%</p>
                            <div className="mt-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-600" style={{ width: `${candidate.skillScore * 100}%` }}></div>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-600 mb-1">时间评分</p>
                            <p className="text-xl font-bold text-green-600">{(candidate.timeScore * 100).toFixed(0)}%</p>
                            <div className="mt-1 h-1.5 bg-green-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500" style={{ width: `${candidate.timeScore * 100}%` }}></div>
                            </div>
                          </div>
                          <div className="col-span-2 bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg p-3 text-white border border-blue-900">
                            <p className="text-xs text-blue-100 mb-1">综合评分 Final Score</p>
                            <p className="text-2xl font-bold">{(candidate.finalScore * 100).toFixed(0)}%</p>
                            <p className="text-[11px] text-blue-100 mt-1">0.5×能力匹配 + 0.5×可用时间率</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedCandidate(candidate);
                              setExplainDrawerOpen(true);
                            }}
                            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                          >
                            查看详情
                          </button>

                          {confirmingId === candidate.userId ? (
                            // 内联确认区域
                            <div className="flex-1 flex gap-2">
                              <button
                                onClick={() => {
                                  setConfirmingId(null);
                                  if (!currentTaskInfo) {
                                    alert('任务信息丢失，请重新预览匹配');
                                    return;
                                  }
                                  // 提交申请始终走审批流程（pending_approval）
                                  submitMutation.mutate({ candidate, taskInfo: currentTaskInfo });
                                }}
                                disabled={submitMutation.isPending || forceAssignMutation.isPending}
                                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors text-sm font-medium disabled:opacity-50"
                              >
                                {(submitMutation.isPending || forceAssignMutation.isPending) ? '处理中...' : '确认提交'}
                              </button>
                              <button
                                onClick={() => setConfirmingId(null)}
                                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 flex gap-2">
                              {/* 提交申请按钮（所有人） */}
                              <button
                                onClick={() => setConfirmingId(candidate.userId)}
                                disabled={submitMutation.isPending || forceAssignMutation.isPending}
                                className="flex-1 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium disabled:opacity-50"
                              >
                                提交申请
                              </button>
                              {/* admin 对不合格候选人额外显示强制指派 */}
                              {isAdmin && !candidate.qualified && (
                                <button
                                  onClick={() => {
                                    if (!currentTaskInfo) {
                                      alert('请先点击预览匹配');
                                      return;
                                    }
                                    forceAssignMutation.mutate({ candidate, taskInfo: currentTaskInfo });
                                  }}
                                  disabled={submitMutation.isPending || forceAssignMutation.isPending}
                                  className="flex-1 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors text-sm font-medium disabled:opacity-50"
                                  title="跳过审批，直接写入日程"
                                >
                                  强制指派
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {candidates.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">匹配报告摘要 Matching Report</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="py-2 pr-4 font-medium">候选人</th>
                      <th className="py-2 pr-4 font-medium">部门</th>
                      <th className="py-2 pr-4 font-medium">综合得分</th>
                      <th className="py-2 pr-4 font-medium">能力匹配</th>
                      <th className="py-2 pr-4 font-medium">时间匹配</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topReport.map(row => (
                      <tr key={row.name} className="border-t border-gray-100">
                        <td className="py-2 pr-4 text-gray-900 font-medium">{row.name}</td>
                        <td className="py-2 pr-4 text-gray-600">{row.dept}</td>
                        <td className="py-2 pr-4 text-blue-900 font-semibold">{row.finalScore}%</td>
                        <td className="py-2 pr-4">{row.skillScore}%</td>
                        <td className="py-2 pr-4">{row.timeScore}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {explainDrawerOpen && selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
          <div className="w-[600px] h-full bg-white shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">匹配详情 Match Details</h3>
                <button
                  onClick={() => setExplainDrawerOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-2">{selectedCandidate.name}</h4>
                  <p className="text-sm text-gray-600">{selectedCandidate.dept}</p>
                  <p className="text-sm text-gray-600">Home: {selectedCandidate.homeLocation}</p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-3">能力评分详情 Skill Score Details</h4>
                  <div className="space-y-3">
                    {selectedCandidate.explain.items.map((item, idx) => {
                      const itemData = items?.find(i => i.id === item.itemId);
                      return (
                        <div key={idx} className="p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{itemData?.name}</p>
                              {item.isKey && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                                  关键项 Key
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-bold text-blue-900">
                              {item.si.toFixed(2)}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                            <div>Ci: {item.Ci}</div>
                            <div>Ri: {item.Ri}</div>
                            <div>Ti: {item.Ti}</div>
                            <div>w: {item.w}</div>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            base: {item.base.toFixed(2)} · bonus: {item.bonus.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Weight: {selectedCandidate.explain.sumW}</p>
                    <p className="text-sm font-bold text-gray-900">Final Skill Score: {(selectedCandidate.explain.skillScore * 100).toFixed(0)}%</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-3">时间可用性 Time Availability</h4>
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">已占用时间段</span>
                      <span className="font-bold text-gray-900">{selectedCandidate.explain.time.workSlots}</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600">空闲时间段</span>
                      <span className="font-bold text-green-600">{selectedCandidate.explain.time.freeSlots}</span>
                    </div>
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${(selectedCandidate.explain.time.freeSlots / (selectedCandidate.explain.time.workSlots + selectedCandidate.explain.time.freeSlots)) * 100}%`
                        }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Time Score: {(selectedCandidate.explain.time.timeScore * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-3">角色门槛检查 Role Gate Check</h4>
                  <div className="p-4 border border-gray-200 rounded-lg space-y-2">
                    <div className={cn('p-3 rounded-lg flex items-center gap-2 border', getRoleGateColor(selectedCandidate.roleGate))}>
                      {selectedCandidate.roleGate === 'OK' ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <AlertCircle className="w-5 h-5" />
                      )}
                      <span className="font-medium">{selectedCandidate.roleGate}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      <p className="mb-1">角色要求 Role: {watch('role')}</p>
                      {(watch('role') === 'Lead' || watch('role') === 'Expert') && (
                        <div className="mt-2 space-y-1 text-xs">
                          <p>· Key item mean ≥ {ROLE_THRESHOLDS[watch('role') as 'Lead' | 'Expert'].keyItem}</p>
                          <p>· Module mean ≥ {ROLE_THRESHOLDS[watch('role') as 'Lead' | 'Expert'].moduleMean}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* 任务看板视图 */}
      {activeTab === 'kanban' && (
        <TaskKanban tasks={matchingHistory} submissionFeedback={submissionFeedback} />
      )}
    </div>
  );
}

// 任务看板组件
function TaskKanban({
  tasks,
  submissionFeedback,
}: {
  tasks: any[];
  submissionFeedback: {
    taskId: string;
    taskName: string;
    employeeName: string;
    status: 'pending_approval' | 'planned';
  } | null;
}) {
  const queryClient = useQueryClient();
  const { user } = useNewAuth();
  const isAdmin = user?.role === 'admin';

  // 调试：打印传入的 tasks
  useEffect(() => {
    console.log('📊 [TaskKanban] 收到 tasks 数据:', tasks);
    console.log('📊 [TaskKanban] tasks 长度:', tasks?.length || 0);
  }, [tasks]);

  type KanbanTab = 'matching' | 'pending' | 'assigned' | 'rejected';
  const [selectedTab, setSelectedTab] = useState<KanbanTab>('pending');
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 将数据库真实 status 映射到看板分组
  const toKanbanStatus = (dbStatus: string): KanbanTab => {
    if (dbStatus === 'pending_approval') return 'pending';
    if (['planned', 'confirmed', 'in_progress', 'completed'].includes(dbStatus)) return 'assigned';
    if (['rejected', 'employee_rejected', 'cancelled'].includes(dbStatus)) return 'rejected';
    return 'matching'; // 不存在的状态兜底
  };

  const tasksByStatus = useMemo(() => {
    const groups: Record<KanbanTab, any[]> = {
      matching: [],
      pending: [],
      assigned: [],
      rejected: [],
    };
    tasks.forEach(task => {
      const bucket = toKanbanStatus(task.status || '');
      console.log(`🏷️ [TaskKanban] 任务 "${task.taskName}" 状态=${task.status} → 看板分组=${bucket}`);
      groups[bucket].push(task);
    });
    console.log('📦 [TaskKanban] 按状态分组后:', {
      matching: groups.matching.length,
      pending: groups.pending.length,
      assigned: groups.assigned.length,
      rejected: groups.rejected.length,
    });
    return groups;
  }, [tasks]);

  const approveMutation = useMutation({
    mutationFn: (taskId: string) => taskWorkflowService.approve(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matching-history'] }),
    onError: (e: any) => alert(`审批失败: ${e.message}`),
  });

  const adminRejectMutation = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
      taskWorkflowService.reject(taskId, reason),
    onSuccess: () => {
      setRejectModal(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['matching-history'] });
    },
    onError: (e: any) => alert(`拒绝失败: ${e.message}`),
  });

  const statusConfig: Record<KanbanTab, { title: string; icon: any; headerColor: string; badgeColor: string; cardBorder: string }> = {
    matching: {
      title: '匹配中',
      icon: GitMerge,
      headerColor: 'bg-blue-50 border-blue-200',
      badgeColor: 'bg-blue-100 text-blue-700',
      cardBorder: 'border-blue-200',
    },
    pending: {
      title: '待审批',
      icon: Clock,
      headerColor: 'bg-amber-50 border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-700',
      cardBorder: 'border-amber-200',
    },
    assigned: {
      title: '已分配',
      icon: CheckCircle,
      headerColor: 'bg-green-50 border-green-200',
      badgeColor: 'bg-green-100 text-green-700',
      cardBorder: 'border-green-200',
    },
    rejected: {
      title: '已拒绝',
      icon: X,
      headerColor: 'bg-red-50 border-red-200',
      badgeColor: 'bg-red-100 text-red-700',
      cardBorder: 'border-red-200',
    },
  };

  const dbStatusLabel: Record<string, string> = {
    pending_approval: '待审批',
    planned: '待工程师确认',
    confirmed: '已确认',
    in_progress: '进行中',
    completed: '已完成',
    rejected: '已拒绝',
    employee_rejected: '工程师拒绝',
    cancelled: '已取消',
  };

  const nextStepLabel: Record<string, string> = {
    pending_approval: '下一步：等待 Site PS 审批',
    planned: '下一步：等待工程师在日程管理中接受或拒绝',
    confirmed: '下一步：工程师已接受，流程完成',
    in_progress: '下一步：任务执行中',
    completed: '下一步：任务已完成',
    rejected: '下一步：申请已结束，可修改后重新提交',
    employee_rejected: '下一步：工程师已退回，请重新分配或调整需求',
    cancelled: '下一步：任务已取消',
  };

  const currentTasks = tasksByStatus[selectedTab];

  return (
    <>
      {/* 四个状态标签页 */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.keys(statusConfig) as KanbanTab[]).map(tab => {
          const config = statusConfig[tab];
          const Icon = config.icon;
          const count = tasksByStatus[tab].length;
          const isActive = selectedTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={cn(
                'rounded-2xl p-4 border-2 flex items-center justify-between transition-all text-left',
                isActive
                  ? `${config.headerColor} border-current shadow-md`
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('w-5 h-5', isActive ? 'text-current' : 'text-gray-400')} />
                <div>
                  <p className={cn('font-bold text-sm', isActive ? '' : 'text-gray-700')}>{config.title}</p>
                  <p className="text-xs text-gray-400">Task Board</p>
                </div>
              </div>
              <span className={cn('text-2xl font-bold', isActive ? '' : 'text-gray-600')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 选中分组的任务列表 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className={cn('px-6 py-4 rounded-t-2xl border-b flex items-center justify-between', statusConfig[selectedTab].headerColor)}>
          <div className="flex items-center gap-2">
            {(() => { const Icon = statusConfig[selectedTab].icon; return <Icon className="w-5 h-5" />; })()}
            <h3 className="font-bold text-gray-900">{statusConfig[selectedTab].title}任务列表</h3>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusConfig[selectedTab].badgeColor)}>
              {currentTasks.length} 个任务
            </span>
          </div>
          {selectedTab === 'pending' && isAdmin && (
            <p className="text-xs text-amber-700">点击"审批通过"或"拒绝"完成审批</p>
          )}
        </div>

        {submissionFeedback && (
          <div className={cn(
            'mx-4 mt-4 rounded-xl border px-4 py-3',
            submissionFeedback.status === 'pending_approval'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-green-50 border-green-200 text-green-800'
          )}>
            <p className="text-sm font-bold">
              {submissionFeedback.status === 'pending_approval' ? '你刚提交的任务申请已进入待审批' : '你刚提交的任务已进入待确认'}
            </p>
            <p className="text-sm mt-1">
              {submissionFeedback.taskName} {'->'} {submissionFeedback.employeeName}
            </p>
            <p className="text-xs mt-2">
              {submissionFeedback.status === 'pending_approval'
                ? '下一步：等待 Site PS 审批。'
                : '下一步：等待工程师确认接受。'}
            </p>
          </div>
        )}

        <div className="p-4">
          {currentTasks.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-base font-medium">暂无任务</p>
              <p className="text-sm mt-1">No tasks in this category</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentTasks.map(task => (
                <div
                  key={task.id}
                  className={cn('rounded-xl border-2 p-4 bg-white hover:shadow-md transition-all', statusConfig[selectedTab].cardBorder)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-bold text-gray-900">{task.taskName}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {dbStatusLabel[task.status] || task.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 mt-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{task.location}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                          <span>{task.startDate} ~ {task.endDate}</span>
                        </div>
                        {task.employeeName && (
                          <div className="flex items-center gap-1">
                            <span>👤</span>
                            <span className="font-medium">{task.employeeName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-gray-400 text-xs">
                          <span>提交: {task.createdAt ? new Date(task.createdAt).toLocaleDateString('zh-CN') : '-'}</span>
                        </div>
                      </div>
                      {task.rejectionReason && (
                        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                          拒绝原因: {task.rejectionReason}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
                        {nextStepLabel[task.status] || '下一步：请关注后续状态变化'}
                      </p>
                    </div>

                    {/* 操作按钮 */}
                    {selectedTab === 'pending' && isAdmin && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => approveMutation.mutate(task.id)}
                          disabled={approveMutation.isPending}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          ✅ 审批通过
                        </button>
                        <button
                          onClick={() => { setRejectModal({ id: task.id, name: task.taskName }); setRejectReason(''); }}
                          disabled={adminRejectMutation.isPending}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          ❌ 拒绝
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 拒绝原因弹窗 */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md">
            <h4 className="font-bold text-gray-900 mb-1">拒绝任务申请</h4>
            <p className="text-sm text-gray-500 mb-3">{rejectModal.name}</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="请输入拒绝原因（必填）"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) { alert('请填写拒绝原因'); return; }
                  adminRejectMutation.mutate({ taskId: rejectModal.id, reason: rejectReason });
                }}
                disabled={adminRejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50"
              >
                {adminRejectMutation.isPending ? '处理中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
