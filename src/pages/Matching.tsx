import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { mockApi } from '../lib/mockApi';
import { TASK_TYPES, LOCATIONS, TOPICS, ROLES, ROLE_THRESHOLDS } from '../lib/constants';
import type { MatchingRequest, MatchingCandidate } from '../lib/types';
import { cn } from '../lib/utils';
import { Plus, Trash2, Search, AlertCircle, CheckCircle, X, MapPin, GitMerge, ClipboardList, CalendarCheck, ArrowRight, Sparkles } from 'lucide-react';

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
  const [requiredItems, setRequiredItems] = useState<Array<{ itemId: number; requiredLevel: number; isKey: boolean }>>([]);
  const [candidates, setCandidates] = useState<MatchingCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<MatchingCandidate | null>(null);
  const [explainDrawerOpen, setExplainDrawerOpen] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(matchingSchema),
    defaultValues: {
      role: 'Lead' as const,
      type: 'P',
      location: 'FDCCh',
      topic: 'TPM',
      moduleId: '',
    },
  });

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: mockApi.getCompetencyModules,
  });

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: mockApi.getCompetencyItems,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: mockApi.getUsers,
  });

  const moduleId = watch('moduleId');

  useEffect(() => {
    if (modules && modules.length > 0 && !moduleId) {
      setValue('moduleId', String(modules[0].id));
    }
  }, [modules, moduleId, setValue]);

  const previewMutation = useMutation({
    mutationFn: (data: MatchingRequest) => mockApi.previewMatching(data),
    onSuccess: (data) => {
      setCandidates(data);
    },
  });

  const assignMutation = useMutation({
    mutationFn: () => mockApi.assignTask(),
    onSuccess: () => {
      alert('任务已成功指派 Task assigned successfully');
    },
  });

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
    return [
      { key: 'apply', label: '任务申请', desc: '需求方提交需求', status: 'done' as const, icon: ClipboardList },
      { key: 'match', label: '智能匹配', desc: '系统打分推荐', status: previewMutation.isPending ? 'processing' as const : hasPreview ? 'done' as const : 'pending' as const, icon: GitMerge },
      { key: 'approve', label: '任务审批', desc: 'Site PS 审批', status: assignMutation.isPending ? 'processing' as const : assignMutation.isSuccess ? 'done' as const : 'pending' as const, icon: CheckCircle },
      { key: 'sync', label: '日程同步', desc: '自动写入日历', status: assignMutation.isSuccess ? 'done' as const : 'pending' as const, icon: CalendarCheck },
    ];
  }, [candidates.length, previewMutation.isPending, assignMutation.isPending, assignMutation.isSuccess]);

  const topReport = useMemo(() => candidates.slice(0, 3).map(candidate => ({
    name: candidate.name,
    dept: candidate.dept,
    finalScore: Math.round(candidate.finalScore * 100),
    skillScore: Math.round(candidate.skillScore * 100),
    timeScore: Math.round(candidate.timeScore * 100),
  })), [candidates]);

  return (
    <div className="space-y-6">
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
                <select {...register('topic')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  {TOPICS.map(topic => (
                    <option key={topic.code} value={topic.code}>{topic.name}</option>
                  ))}
                </select>
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
                  {users?.map(user => (
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
                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <select
                        value={item.itemId}
                        onChange={(e) => updateRequiredItem(index, 'itemId', parseInt(e.target.value, 10))}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {availableItems.map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                      <select
                        value={item.requiredLevel}
                        onChange={(e) => updateRequiredItem(index, 'requiredLevel', parseInt(e.target.value, 10))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {[1, 2, 3, 4, 5].map(level => (
                          <option key={level} value={level}>L{level}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={item.isKey}
                          onChange={(e) => updateRequiredItem(index, 'isKey', e.target.checked)}
                          className="rounded"
                        />
                        关键 Key
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRequiredItem(index)}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                系统按照「0.5×能力匹配 + 0.5×可用时间率」计算综合得分，并对关键项自动加权。
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
                    <p>系统已识别 {qualifiedCandidates.length} 位得分 ≥100% 的合适人选。</p>
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
                    <p>暂未找到得分 ≥100% 的人选，以下候选作为 Top3 推荐供 Site PS 参考。</p>
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
                  {candidates.length} 人 candidates
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
                          <button
                            onClick={() => {
                              if (confirm(`确认指派任务给 ${candidate.name}？`)) {
                                assignMutation.mutate();
                              }
                            }}
                            disabled={assignMutation.isPending}
                            className="flex-1 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {assignMutation.isPending ? '指派中...' : '立即指派'}
                          </button>
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
    </div>
  );
}
