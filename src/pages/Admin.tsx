/**
 * Admin Panel - 管理员数据管理页面
 * 
 * 功能：
 * - Departments/Employees/Skills 三个Tab
 * - 数据列表展示
 * - CRUD 操作
 * - CSV/Excel 批量导入
 * - CSV 批量导出
 * - 批量删除
 * - 导入历史记录查询
 */

import { useState } from 'react';
import { Database, Users, BookOpen, Upload, Download, Trash2, Plus, Edit, Eye, History, ClipboardCheck, X, Check, KeyRound } from 'lucide-react';
import { AdminImportCard } from '@/components/AdminImportCard';
import { ImportHistoryView } from '@/components/ImportHistoryView';
import { AdminAccountsPanel } from '@/components/AdminAccountsPanel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDepartments, getEmployees, getSkills,
  exportDepartmentsCSV, exportEmployeesCSV, exportSkillsCSV, downloadBlob,
  createDepartment, createEmployee, createSkill,
  updateDepartment, updateEmployee, updateSkill,
  deleteDepartment, deleteEmployee, deleteSkill,
} from '@/services/adminService';
import { taskWorkflowService } from '../services/task-workflow.service';
import axios from 'axios';

type TabType = 'departments' | 'employees' | 'skills' | 'history' | 'approvals' | 'accounts';

// 9大能力模块选项
const MODULE_OPTIONS = [
  { id: 1, name: 'BPS elements' },
  { id: 2, name: 'Investment efficiency_PGL' },
  { id: 3, name: 'Waste-free, stable flow_IE' },
  { id: 4, name: 'Waste-free, stable flow_TPM' },
  { id: 5, name: 'Waste-free, stable flow_LBP' },
  { id: 6, name: "Everybody's CIP" },
  { id: 7, name: 'Leadership commitment' },
  { id: 8, name: 'CIP in indirect area_LEAN' },
  { id: 9, name: 'Digital Transformation' },
];

const INIT_DEPT_FORM = { name: '', code: '', description: '' };
const INIT_EMP_FORM  = { employee_id: '', name: '', department_id: '', email: '', position: '', phone: '' };
const INIT_SKILL_FORM = { module_id: 1, module_name: 'BPS elements', skill_name: '', skill_code: '', description: '', display_order: 1 };

export function Admin() {
  const [activeTab, setActiveTab] = useState<TabType>('departments');
  const [showImport, setShowImport] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [deptForm, setDeptForm] = useState(INIT_DEPT_FORM);
  const [empForm, setEmpForm]   = useState(INIT_EMP_FORM);
  const [skillForm, setSkillForm] = useState(INIT_SKILL_FORM);
  const queryClient = useQueryClient();

  // ── Mutations ──
  // 格式化 API 错误消息（处理 FastAPI 422 数组格式）
  const fmtErr = (e: any): string => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((d: any) => `${d.loc?.slice(-1)[0] ?? ''}: ${d.msg}`).join('\n');
    }
    return detail || e?.message || '未知错误';
  };

  const addDeptMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      setModalMode(null);
      setSelectedItem(null);
      setDeptForm(INIT_DEPT_FORM);
    },
    onError: (e: any) => alert(`新增失败:\n${fmtErr(e)}`),
  });

  const addEmpMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      setModalMode(null);
      setSelectedItem(null);
      setEmpForm(INIT_EMP_FORM);
    },
    onError: (e: any) => alert(`新增失败:\n${fmtErr(e)}`),
  });

  const addSkillMutation = useMutation({
    mutationFn: createSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-skills'] });
      setModalMode(null);
      setSelectedItem(null);
      setSkillForm(INIT_SKILL_FORM);
    },
    onError: (e: any) => alert(`新增失败:\n${fmtErr(e)}`),
  });

  // ── Edit mutations ──
  const editDeptMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      setModalMode(null);
      setSelectedItem(null);
      setDeptForm(INIT_DEPT_FORM);
    },
    onError: (e: any) => alert(`更新失败:\n${fmtErr(e)}`),
  });

  const editEmpMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      setModalMode(null);
      setSelectedItem(null);
      setEmpForm(INIT_EMP_FORM);
    },
    onError: (e: any) => alert(`更新失败:\n${fmtErr(e)}`),
  });

  const editSkillMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateSkill(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-skills'] });
      setModalMode(null);
      setSelectedItem(null);
      setSkillForm(INIT_SKILL_FORM);
    },
    onError: (e: any) => alert(`更新失败:\n${fmtErr(e)}`),
  });

  // ── Delete mutations ──
  const delDeptMutation = useMutation({
    mutationFn: (id: number) => deleteDepartment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-departments'] }),
    onError: (e: any) => alert(`删除失败:\n${fmtErr(e)}`),
  });

  const delEmpMutation = useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-employees'] }),
    onError: (e: any) => alert(`删除失败:\n${fmtErr(e)}`),
  });

  const delSkillMutation = useMutation({
    mutationFn: (id: number) => deleteSkill(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-skills'] }),
    onError: (e: any) => alert(`删除失败:\n${fmtErr(e)}`),
  });

  const isSubmitting =
    addDeptMutation.isPending || addEmpMutation.isPending || addSkillMutation.isPending ||
    editDeptMutation.isPending || editEmpMutation.isPending || editSkillMutation.isPending;

  const closeModal = () => { setModalMode(null); setSelectedItem(null); };

  const openModal = (mode: 'view' | 'edit', item: any) => {
    setSelectedItem(item);
    if (activeTab === 'departments') {
      setDeptForm({ name: item.name, code: item.code || '', description: item.description || '' });
    } else if (activeTab === 'employees') {
      setEmpForm({
        employee_id: item.employee_id,
        name: item.name,
        department_id: String(item.department_id || ''),
        email: item.email || '',
        position: item.position || '',
        phone: item.phone || '',
      });
    } else if (activeTab === 'skills') {
      setSkillForm({
        module_id: item.module_id,
        module_name: item.module_name,
        skill_name: item.skill_name,
        skill_code: item.skill_code || '',
        description: item.description || '',
        display_order: item.display_order,
      });
    }
    setModalMode(mode);
  };

  const handleDelete = (item: any) => {
    const label = item.name || item.skill_name || item.employee_id || '该项目';
    if (!window.confirm(`确认删除"${label}"？此操作不可撤销。`)) return;
    if (activeTab === 'departments') delDeptMutation.mutate(item.id);
    else if (activeTab === 'employees') delEmpMutation.mutate(item.id);
    else if (activeTab === 'skills') delSkillMutation.mutate(item.id);
  };

  const handleAddSubmit = () => {
    if (activeTab === 'departments') {
      if (!deptForm.name.trim()) { alert('请输入部门名称'); return; }
      const deptData = { name: deptForm.name, code: deptForm.code || undefined, description: deptForm.description || undefined };
      if (modalMode === 'add') addDeptMutation.mutate(deptData);
      else editDeptMutation.mutate({ id: selectedItem.id, data: deptData });
    } else if (activeTab === 'employees') {
      if (!empForm.employee_id.trim() || !empForm.name.trim() || !empForm.department_id) {
        alert('员工工号、姓名、部门为必填项'); return;
      }
      const empData = {
        employee_id: empForm.employee_id,
        name: empForm.name,
        department_id: Number(empForm.department_id),
        email: empForm.email || undefined,
        position: empForm.position || undefined,
        phone: empForm.phone || undefined,
      };
      if (modalMode === 'add') addEmpMutation.mutate(empData);
      else editEmpMutation.mutate({ id: selectedItem.id, data: empData });
    } else if (activeTab === 'skills') {
      if (!skillForm.skill_name.trim()) { alert('请输入技能名称'); return; }
      const skillData = {
        module_id: skillForm.module_id,
        module_name: skillForm.module_name,
        skill_name: skillForm.skill_name,
        skill_code: skillForm.skill_code || undefined,
        description: skillForm.description || undefined,
        display_order: skillForm.display_order,
      };
      if (modalMode === 'add') addSkillMutation.mutate(skillData);
      else editSkillMutation.mutate({ id: selectedItem.id, data: skillData });
    }
  };

  // 查询数据
  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => getDepartments(false),
  });

  const { data: employees = [], isLoading: loadingEmps } = useQuery({
    queryKey: ['admin-employees'],
    queryFn: () => getEmployees(false),
    enabled: activeTab === 'employees',
  });

  const { data: skills = [], isLoading: loadingSkills } = useQuery({
    queryKey: ['admin-skills'],
    queryFn: () => getSkills(undefined, false),
    enabled: activeTab === 'skills',
  });

  // 待审批任务查询
  const token = localStorage.getItem('access_token');
  const { data: pendingTasks = [], refetch: refetchPending } = useQuery({
    queryKey: ['pending-approval-tasks'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:8000/api/tasks', {
        params: { status: 'pending_approval' },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.data as any[];
    },
    enabled: activeTab === 'approvals',
  });

  // 审批/拒绝 state
  const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const approveMutation = useMutation({
    mutationFn: (taskId: string) => taskWorkflowService.approve(taskId),
    onSuccess: () => { refetchPending(); queryClient.invalidateQueries({ queryKey: ['tasks'] }); },
    onError: (e: any) => alert(`审批失败: ${e.message}`),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
      taskWorkflowService.reject(taskId, reason),
    onSuccess: () => {
      setRejectingTaskId(null);
      setRejectReason('');
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e: any) => alert(`拒绝失败: ${e.message}`),
  });

  // 导出 CSV
  const handleExport = async () => {
    try {
      let blob: Blob;
      let filename: string;

      if (activeTab === 'departments') {
        blob = await exportDepartmentsCSV(false);
        filename = `departments_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (activeTab === 'employees') {
        blob = await exportEmployeesCSV(false);
        filename = `employees_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        blob = await exportSkillsCSV(false);
        filename = `skills_${new Date().toISOString().split('T')[0]}.csv`;
      }

      downloadBlob(blob, filename);
    } catch (error: any) {
      alert(`导出失败: ${error.message}`);
    }
  };

  const tabs = [
    { id: 'departments' as TabType, label: '部门管理', icon: Database, count: departments.length },
    { id: 'employees' as TabType, label: '员工管理', icon: Users, count: employees.length },
    { id: 'skills' as TabType, label: '技能管理', icon: BookOpen, count: skills.length },
    { id: 'history' as TabType, label: '导入历史', icon: History, count: 0 },
    { id: 'approvals' as TabType, label: '待审批任务', icon: ClipboardCheck, count: pendingTasks.length },
    { id: 'accounts' as TabType, label: '账号管理', icon: KeyRound, count: 0 },
  ];

  const isLoading =
    (activeTab === 'departments' && loadingDepts) ||
    (activeTab === 'employees' && loadingEmps) ||
    (activeTab === 'skills' && loadingSkills);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            管理员控制台
          </h1>
          <p className="text-gray-600">
            Admin Panel | 数据管理 · 批量导入导出
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-5 py-3 rounded-xl font-medium transition-all ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-lg scale-105'
                    : 'bg-white/60 text-gray-700 hover:bg-white hover:shadow-md'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Actions Bar - 仅在数据管理tab显示 */}
        {activeTab !== 'history' && activeTab !== 'approvals' && activeTab !== 'accounts' && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowImport(!showImport)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                showImport
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              <Upload className="w-4 h-4" />
              {showImport ? '关闭导入' : '批量导入'}
            </button>
            
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg font-medium hover:bg-green-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 CSV
            </button>

            <div className="flex-1" />

            <button
              onClick={() => { setDeptForm(INIT_DEPT_FORM); setEmpForm(INIT_EMP_FORM); setSkillForm(INIT_SKILL_FORM); setSelectedItem(null); setModalMode('add'); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增
            </button>
          </div>
        </div>
        )}

        {/* Import Section */}
        {showImport && activeTab !== 'history' && activeTab !== 'accounts' && (
          <div className="mb-6">
            {activeTab === 'departments' && (
              <AdminImportCard
                tableType="departments"
                title="导入部门数据"
                description="Departments | 批量上传部门信息"
                icon={<Database className="w-6 h-6 text-blue-600" />}
                color="bg-blue-100"
                templateFields={['ID', '部门名称', '部门代码', '描述']}
              />
            )}
            {activeTab === 'employees' && (
              <AdminImportCard
                tableType="employees"
                title="导入员工数据"
                description="Employees | 批量上传员工信息"
                icon={<Users className="w-6 h-6 text-green-600" />}
                color="bg-green-100"
                templateFields={['ID', '员工工号', '姓名', '部门ID', '邮箱', '职位', '电话']}
              />
            )}
            {activeTab === 'skills' && (
              <AdminImportCard
                tableType="skills"
                title="导入技能数据"
                description="Skills | 批量上传技能定义"
                icon={<BookOpen className="w-6 h-6 text-purple-600" />}
                color="bg-purple-100"
                templateFields={['ID', '模块ID', '模块名称', '技能名称', '技能代码', '描述', '显示顺序']}
              />
            )}
          </div>
        )}

        {/* History Tab Content */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <ImportHistoryView />
          </div>
        )}

        {/* Approvals Tab Content */}
        {activeTab === 'approvals' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              待审批任务 Pending Approvals
              <span className="ml-2 text-sm font-normal text-gray-500">({pendingTasks.length} 条待处理)</span>
            </h3>
            {pendingTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Check className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p>暂无待审批任务</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task: any) => (
                  <div key={task.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{task.task_name || task.name}</p>
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                          <span>👤 {task.assigned_employee_name || task.assigned_employee_id}</span>
                          <span>📅 {task.start_date} → {task.end_date}</span>
                          {task.task_type && <span>🏷️ {task.task_type}</span>}
                          {task.task_location && <span>📍 {task.task_location}</span>}
                        </div>
                        {task.notes && (
                          <p className="mt-1 text-xs text-gray-400">{task.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => approveMutation.mutate(task.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          同意
                        </button>
                        <button
                          onClick={() => { setRejectingTaskId(task.id); setRejectReason(''); }}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          拒绝
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 拒绝原因弹窗 */}
            {rejectingTaskId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md">
                  <h4 className="font-bold text-gray-900 mb-3">填写拒绝原因</h4>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="请输入拒绝原因（必填）"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                  />
                  <div className="flex gap-3 mt-4 justify-end">
                    <button
                      onClick={() => setRejectingTaskId(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        if (!rejectReason.trim()) { alert('请填写拒绝原因'); return; }
                        rejectMutation.mutate({ taskId: rejectingTaskId, reason: rejectReason });
                      }}
                      disabled={rejectMutation.isPending}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50"
                    >
                      {rejectMutation.isPending ? '处理中...' : '确认拒绝'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'accounts' && <AdminAccountsPanel />}

        {/* Data Table */}
        {activeTab !== 'history' && activeTab !== 'approvals' && activeTab !== 'accounts' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">
              {activeTab === 'departments' && '部门列表'}
              {activeTab === 'employees' && '员工列表'}
              {activeTab === 'skills' && '技能列表'}
            </h3>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {activeTab === 'departments' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">部门名称</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">代码</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                      </>
                    )}
                    {activeTab === 'employees' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">员工工号</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">部门ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">邮箱</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">职位</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                      </>
                    )}
                    {activeTab === 'skills' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">模块</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">技能名称</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">代码</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">显示顺序</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Departments */}
                  {activeTab === 'departments' && departments.map((dept: any) => (
                    <tr key={dept.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dept.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{dept.code || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{dept.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => openModal('view', dept)} className="text-blue-600 hover:text-blue-800 mr-3" title="查看">
                          <Eye className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => openModal('edit', dept)} className="text-gray-600 hover:text-gray-800 mr-3" title="编辑">
                          <Edit className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => handleDelete(dept)} className="text-red-600 hover:text-red-800" title="删除">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Employees */}
                  {activeTab === 'employees' && employees.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.employee_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{emp.department_id || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{emp.email || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{emp.position || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => openModal('view', emp)} className="text-blue-600 hover:text-blue-800 mr-3" title="查看">
                          <Eye className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => openModal('edit', emp)} className="text-gray-600 hover:text-gray-800 mr-3" title="编辑">
                          <Edit className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => handleDelete(emp)} className="text-red-600 hover:text-red-800" title="删除">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Skills */}
                  {activeTab === 'skills' && skills.map((skill: any) => (
                    <tr key={skill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{skill.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{skill.module_name}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{skill.skill_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{skill.skill_code || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{skill.display_order}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => openModal('view', skill)} className="text-blue-600 hover:text-blue-800 mr-3" title="查看">
                          <Eye className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => openModal('edit', skill)} className="text-gray-600 hover:text-gray-800 mr-3" title="编辑">
                          <Edit className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => handleDelete(skill)} className="text-red-600 hover:text-red-800" title="删除">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Empty State */}
          {!isLoading && (
            <>
              {activeTab === 'departments' && departments.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Database className="w-16 h-16 mb-4 opacity-50" />
                  <p>暂无部门数据</p>
                </div>
              )}
              {activeTab === 'employees' && employees.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Users className="w-16 h-16 mb-4 opacity-50" />
                  <p>暂无员工数据</p>
                </div>
              )}
              {activeTab === 'skills' && skills.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <BookOpen className="w-16 h-16 mb-4 opacity-50" />
                  <p>暂无技能数据</p>
                </div>
              )}
            </>
          )}
        </div>
        )}
      </div>

      {/* ── 新增弹窗 ── */}
      {modalMode !== null && activeTab !== 'history' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {activeTab === 'departments' && (modalMode === 'add' ? '新增部门' : modalMode === 'edit' ? '编辑部门' : '查看部门')}
                {activeTab === 'employees' && (modalMode === 'add' ? '新增员工' : modalMode === 'edit' ? '编辑员工' : '查看员工')}
                {activeTab === 'skills' && (modalMode === 'add' ? '新增技能' : modalMode === 'edit' ? '编辑技能' : '查看技能')}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode - read-only key/value display */}
            {modalMode === 'view' && selectedItem && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm max-h-80 overflow-y-auto">
                {Object.entries(selectedItem)
                  .filter(([k]) => k !== 'is_active')
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-1.5 border-b border-gray-100 last:border-0">
                      <span className="font-medium text-gray-500 w-36 shrink-0">{k}</span>
                      <span className="text-gray-900 break-all">{v == null ? '-' : String(v)}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Department Form */}
            {activeTab === 'departments' && (modalMode === 'add' || modalMode === 'edit') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">部门名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text" value={deptForm.name}
                    onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                    placeholder="请输入部门名称"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">部门代码</label>
                  <input
                    type="text" value={deptForm.code}
                    onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                    placeholder="如：BPS_DEPT"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    value={deptForm.description}
                    onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                    rows={3} placeholder="可选"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* Employee Form */}
            {activeTab === 'employees' && (modalMode === 'add' || modalMode === 'edit') && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">员工工号 <span className="text-red-500">*</span></label>
                    <input
                      type="text" value={empForm.employee_id}
                      onChange={e => setEmpForm({ ...empForm, employee_id: e.target.value })}
                      placeholder="如：EMP001"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">姓名 <span className="text-red-500">*</span></label>
                    <input
                      type="text" value={empForm.name}
                      onChange={e => setEmpForm({ ...empForm, name: e.target.value })}
                      placeholder="请输入姓名"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所属部门 <span className="text-red-500">*</span></label>
                  <select
                    value={empForm.department_id}
                    onChange={e => setEmpForm({ ...empForm, department_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">请选择部门</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                  <input
                    type="email" value={empForm.email}
                    onChange={e => setEmpForm({ ...empForm, email: e.target.value })}
                    placeholder="name@bosch.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">职位</label>
                    <input
                      type="text" value={empForm.position}
                      onChange={e => setEmpForm({ ...empForm, position: e.target.value })}
                      placeholder="如：Engineer"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
                    <input
                      type="text" value={empForm.phone}
                      onChange={e => setEmpForm({ ...empForm, phone: e.target.value })}
                      placeholder="可选"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Skill Form */}
            {activeTab === 'skills' && (modalMode === 'add' || modalMode === 'edit') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所属模块 <span className="text-red-500">*</span></label>
                  <select
                    value={skillForm.module_id}
                    onChange={e => {
                      const id = Number(e.target.value);
                      const name = MODULE_OPTIONS.find(m => m.id === id)?.name || '';
                      setSkillForm({ ...skillForm, module_id: id, module_name: name });
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {MODULE_OPTIONS.map(m => (
                      <option key={m.id} value={m.id}>{m.id}. {m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">技能名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text" value={skillForm.skill_name}
                    onChange={e => setSkillForm({ ...skillForm, skill_name: e.target.value })}
                    placeholder="请输入技能名称"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">技能代码</label>
                    <input
                      type="text" value={skillForm.skill_code}
                      onChange={e => setSkillForm({ ...skillForm, skill_code: e.target.value })}
                      placeholder="如：BPS_S01"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">显示顺序</label>
                    <input
                      type="number" min={1} value={skillForm.display_order}
                      onChange={e => setSkillForm({ ...skillForm, display_order: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    value={skillForm.description}
                    onChange={e => setSkillForm({ ...skillForm, description: e.target.value })}
                    rows={2} placeholder="可选"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
              >
                {modalMode === 'view' ? '关闭' : '取消'}
              </button>
              {modalMode !== 'view' && (
                <button
                  onClick={handleAddSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-60"
                >
                  {isSubmitting ? '提交中...' : modalMode === 'edit' ? '保存修改' : '确认新增'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
