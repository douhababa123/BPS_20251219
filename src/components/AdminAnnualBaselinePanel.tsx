import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import {
  activateBaseline, activateBaselineFromVersion, downloadBaselineTemplate,
  getAssessmentVersions, getBaselineStatus, previewBaseline, type BaselinePreview,
} from '../lib/annualBaselineApi';
import { formatGap, formatLevel } from '../lib/dashboardProgressApi';

function apiError(error: unknown): string {
  const candidate = error as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = candidate.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(item => {
      const value = item as { loc?: Array<string | number>; msg?: string };
      const field = value.loc?.slice(1).join('.') || '请求';
      return `${field}：${value.msg || '参数无效'}`;
    }).join('；');
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const value = detail as { message: unknown; errors?: Array<{ row?: number; field?: string; message?: string }> };
    const first = value.errors?.[0];
    return first
      ? `${String(value.message)}：第 ${first.row || '-'} 行 ${first.field || ''} ${first.message || ''}`.trim()
      : String(value.message);
  }
  return candidate.message || '操作失败';
}

const PREVIEW_PAGE_SIZE = 50;

export function AdminAnnualBaselinePanel() {
  const initialYear = Number(new URLSearchParams(window.location.search).get('year')) || new Date().getFullYear();
  const [year, setYear] = useState(initialYear);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BaselinePreview | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewPage, setPreviewPage] = useState(1);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ['annual-baseline-status', year], queryFn: () => getBaselineStatus(year) });
  const versionsQuery = useQuery({
    queryKey: ['competency-assessment-versions'],
    queryFn: getAssessmentVersions,
    enabled: year >= 2027,
  });
  const previewMutation = useMutation({
    mutationFn: () => previewBaseline(year, file!),
    onSuccess: value => { setPreview(value); setPreviewSearch(''); setPreviewPage(1); setMessage(null); },
    onError: error => { setPreview(null); setMessage(apiError(error)); },
  });
  const activateMutation = useMutation({
    mutationFn: () => activateBaseline(
      year,
      file!,
      preview!.sha256,
      preview!.previewToken,
      statusQuery.data?.active?.id || null,
    ),
    onSuccess: async () => {
      setPreview(null);
      setFile(null);
      setFileInputKey(value => value + 1);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage(`${year} 年初基线已生效；当前能力和历史数据未被覆盖。`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['annual-baseline-status', year] }),
        queryClient.invalidateQueries({ queryKey: ['competency-progress'] }),
        queryClient.invalidateQueries({ queryKey: ['competency-progress-years'] }),
      ]);
    },
    onError: error => setMessage(apiError(error)),
  });
  const versionMutation = useMutation({
    mutationFn: () => activateBaselineFromVersion(year, selectedVersionId, statusQuery.data?.active?.id || null),
    onSuccess: async () => {
      setSelectedVersionId('');
      setMessage(`${year} 年初基线已从所选能力版本建立；当前能力和历史数据未被覆盖。`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['annual-baseline-status', year] }),
        queryClient.invalidateQueries({ queryKey: ['competency-progress'] }),
        queryClient.invalidateQueries({ queryKey: ['competency-progress-years'] }),
      ]);
    },
    onError: error => setMessage(apiError(error)),
  });

  const downloadTemplate = async () => {
    try {
      const blob = await downloadBaselineTemplate();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'bps-year-start-baseline-template.xlsx';
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      setMessage(apiError(error));
    }
  };

  const clearPendingFile = () => {
    setFile(null);
    setFileInputKey(value => value + 1);
    setPreview(null);
    setPreviewSearch('');
    setPreviewPage(1);
    setMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredPreviewRows = useMemo(() => {
    const query = previewSearch.trim().toLocaleLowerCase();
    if (!preview || !query) return preview?.rows || [];
    return preview.rows.filter(row => [
      row.employeeId, row.employeeName, row.moduleName, row.skillName,
      row.sourceCells, row.conversionRule,
    ].some(value => String(value).toLocaleLowerCase().includes(query)));
  }, [preview, previewSearch]);
  const previewPageCount = Math.max(1, Math.ceil(filteredPreviewRows.length / PREVIEW_PAGE_SIZE));
  const previewRows = filteredPreviewRows.slice(
    (previewPage - 1) * PREVIEW_PAGE_SIZE,
    previewPage * PREVIEW_PAGE_SIZE,
  );

  const confirmActivation = () => {
    if (!preview?.valid || !file) return;
    const replacement = statusQuery.data?.active;
    const prompt = replacement
      ? `替换 ${year} 年当前基线将重新计算该年度 KPI 和趋势。旧版本会保留，是否继续？`
      : `确认将此 Excel 设为 ${year} 年初基线？这不会覆盖当前能力或历史数据。`;
    if (window.confirm(prompt)) activateMutation.mutate();
  };

  const confirmVersionActivation = () => {
    if (!selectedVersionId) return;
    const replacement = statusQuery.data?.active;
    const prompt = replacement
      ? `替换 ${year} 年当前基线将重新计算该年度 KPI 和趋势，旧版本会保留。是否继续？`
      : `确认从所选能力版本建立 ${year} 年初基线？这不会覆盖当前能力或历史数据。`;
    if (window.confirm(prompt)) versionMutation.mutate();
  };

  return (
    <div className="space-y-6" data-testid="annual-baseline-panel">
      <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">年初基线管理</h3>
            <p className="mt-1 text-sm text-gray-500">上传只会先校验预览；确认后独立保存基线，不覆盖当前能力和历史。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">
              基线年度
              <input
                aria-label="基线年度"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={event => { setYear(Number(event.target.value)); clearPendingFile(); setSelectedVersionId(''); }}
                className="ml-2 w-24 rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
              <Download className="h-4 w-4" />下载模板
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-5">
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            上传前请检查工作表名称：系统只识别名称完全为 <code className="font-semibold">Current_Target states</code> 的工作表，其他工作表不会读取。
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
            <FileSpreadsheet className="h-9 w-9 text-green-600" />
            <span className="text-sm font-medium text-gray-800">选择经业务确认的年初 Excel（.xlsx）</span>
            <span className="text-xs text-gray-500">2026-07-03 迁移快照不会被自动作为年初基线</span>
            <input
              key={fileInputKey}
              ref={fileInputRef}
              aria-label="上传年初基线 Excel"
              type="file"
              accept=".xlsx"
              className="mt-2 text-sm"
              onChange={event => { setFile(event.target.files?.[0] || null); setPreview(null); setPreviewSearch(''); setPreviewPage(1); setMessage(null); }}
            />
          </label>
          {file && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
              <span className="max-w-full truncate text-gray-700" title={file.name}>{file.name}</span>
              <button type="button" onClick={clearPendingFile} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />移除文件
              </button>
            </div>
          )}
          <div className="mt-4 flex justify-center">
            <button
              disabled={!file || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />{previewMutation.isPending ? '校验中…' : '上传并预览'}
            </button>
          </div>
        </div>

        {year >= 2027 && (
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
            <h4 className="text-sm font-semibold text-gray-900">或从已保存的能力评估版本建立基线</h4>
            <p className="mt-1 text-xs text-gray-600">系统按该版本保存时刻重建完整快照；2026 年不允许使用此方式。</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <select
                aria-label="选择能力评估版本"
                value={selectedVersionId}
                onChange={event => setSelectedVersionId(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">请选择版本</option>
                {(versionsQuery.data || []).map(version => (
                  <option key={version.id} value={version.id}>
                    {version.createdAt ? new Date(version.createdAt).toLocaleString('zh-CN') : version.id} · {version.cellCount} 个修改单元 · {version.createdByEmail || '未知用户'}
                  </option>
                ))}
              </select>
              <button
                disabled={!selectedVersionId || versionMutation.isPending}
                onClick={confirmVersionActivation}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {versionMutation.isPending ? '生效中…' : '从版本建立基线'}
              </button>
            </div>
            {versionsQuery.isError && <p className="mt-2 text-xs text-red-700">能力版本加载失败，请稍后重试。</p>}
          </div>
        )}
      </div>

      {message && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{message}</div>}

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h4 className="font-semibold text-gray-900">{year} 年当前状态</h4>
        {statusQuery.isLoading ? <p className="mt-3 text-sm text-gray-500">加载中…</p> : statusQuery.data?.active ? (
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><span className="text-gray-500">状态：</span><span className="font-medium text-green-700">已生效</span></div>
            <div><span className="text-gray-500">来源：</span>{statusQuery.data.active.source}</div>
            <div><span className="text-gray-500">版本：</span><span title={statusQuery.data.active.id}>{statusQuery.data.active.id.slice(0, 8)}</span></div>
            <div><span className="text-gray-500">文件：</span>{statusQuery.data.active.filename || '历史能力版本'}</div>
            <div><span className="text-gray-500">确认人：</span>{statusQuery.data.active.selectedByEmail || statusQuery.data.active.selectedByUserId || '—'}</div>
            <div><span className="text-gray-500">确认时间：</span>{statusQuery.data.active.selectedAt ? new Date(statusQuery.data.active.selectedAt).toLocaleString('zh-CN') : '—'}</div>
            <div><span className="text-gray-500">覆盖：</span>{statusQuery.data.active.employeeCount} 人 / {statusQuery.data.active.skillCount} 技能</div>
            <div><span className="text-gray-500">单元：</span>{statusQuery.data.active.cellCount}</div>
          </div>
        ) : <p className="mt-3 text-sm font-medium text-amber-700">未设置年度基线</p>}
      </div>

      {preview && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            {preview.valid ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
            <h4 className="font-semibold text-gray-900">预览结果：{preview.valid ? '校验通过' : '校验未通过'}</h4>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>人员 <b>{preview.summary.employeeCount}</b></div>
            <div>技能 <b>{preview.summary.skillCount}</b></div>
            <div>单元 <b>{preview.summary.cellCount}</b></div>
            <div>年初 Level <b>{formatLevel(preview.summary.initialLevel)}</b></div>
            <div>目标 Level <b>{formatLevel(preview.summary.targetLevel)}</b></div>
            <div>年初 GAP <b>{formatGap(preview.summary.initialGap)}</b></div>
          </div>
          <div className="mt-4 grid gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>工作表 <b>{preview.source.sheetName}</b></div>
            <div>格式 <b>{preview.source.layout === 'WIDE_CT' ? '原始 C/T 宽表' : '标准长表'}</b></div>
            <div>源员工行 <b>{preview.source.sourceEmployeeCount}</b></div>
            <div>不适用省略 <b>{preview.source.omittedCellCount}</b></div>
            <div>排除人员 <b>{preview.source.excludedEmployeeCount}</b></div>
            <div>忽略旧列 <b>{preview.source.ignoredSkillColumnCount}</b></div>
            <div>错误 <b className={preview.source.errorCount ? 'text-red-700' : 'text-green-700'}>{preview.source.errorCount}</b></div>
            <div>可预览明细 <b>{preview.rows.length}</b></div>
          </div>
          {preview.errors.length > 0 && (
            <div className="mt-4 max-h-56 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3">
              {preview.errors.map((error, index) => <p key={`${error.row}-${error.field}-${index}`} className="text-sm text-red-700">第 {error.row || '-'} 行 · {error.field}：{error.message}</p>)}
            </div>
          )}
          {preview.rows.length > 0 && (
            <>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <input
                  aria-label="筛选基线预览"
                  value={previewSearch}
                  onChange={event => { setPreviewSearch(event.target.value); setPreviewPage(1); }}
                  placeholder="搜索员工、模块、技能或来源单元格"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:max-w-md"
                />
                <span className="text-xs text-gray-500">共 {filteredPreviewRows.length} 条，第 {previewPage}/{previewPageCount} 页</span>
              </div>
              <div className="mt-4 max-h-80 overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50"><tr><th className="p-2">行</th><th>来源</th><th>员工</th><th>模块 / 技能</th><th>年初</th><th>目标</th><th>GAP</th><th>转换规则</th></tr></thead>
                  <tbody>{previewRows.map(row => <tr key={`${row.row}-${row.skillId}`} className="border-t"><td className="p-2">{row.row}</td><td>{row.sourceCells || '—'}</td><td>{row.employeeName} ({row.employeeId})</td><td>{row.moduleName} / {row.skillName}</td><td>{row.initialCurrent}</td><td>{row.annualTarget}</td><td>{row.gap}</td><td className="pr-2">{row.conversionRule || '—'}</td></tr>)}</tbody>
                </table>
              </div>
              {previewPageCount > 1 && (
                <div className="mt-3 flex justify-end gap-2">
                  <button disabled={previewPage === 1} onClick={() => setPreviewPage(page => Math.max(1, page - 1))} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">上一页</button>
                  <button disabled={previewPage === previewPageCount} onClick={() => setPreviewPage(page => Math.min(previewPageCount, page + 1))} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">下一页</button>
                </div>
              )}
            </>
          )}
          {preview.valid && (
            <>
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={clearPendingFile} className="rounded-lg border px-4 py-2 text-sm">取消</button>
                <button disabled={activateMutation.isPending} onClick={confirmActivation} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {activateMutation.isPending ? '生效中…' : `确认设为 ${year} 年初基线`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {(statusQuery.data?.revisions.length || 0) > 0 && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h4 className="font-semibold text-gray-900">基线版本记录</h4>
          <div className="mt-3 overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="p-2">状态</th><th>来源</th><th>文件</th><th>覆盖</th><th>确认时间</th></tr></thead><tbody>{statusQuery.data!.revisions.map(revision => <tr key={revision.id} className="border-t"><td className="p-2">{revision.isActive ? '生效' : '历史'}</td><td>{revision.source}</td><td>{revision.filename || '—'}</td><td>{revision.cellCount} 单元</td><td>{revision.selectedAt ? new Date(revision.selectedAt).toLocaleString('zh-CN') : '—'}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </div>
  );
}
