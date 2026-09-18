import { Loader2, X } from 'lucide-react';
import type { CompetencyChangeRecord } from '../lib/competencyApi';

interface CompetencyChangeLogDialogProps {
  records: CompetencyChangeRecord[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

function formatChange(record: CompetencyChangeRecord) {
  if (record.previousCurrentLevel === null || record.previousTargetLevel === null) {
    return `新建：现状 L${record.currentLevel}，目标 L${record.targetLevel}`;
  }

  const changes: string[] = [];
  if (record.previousCurrentLevel !== record.currentLevel) {
    changes.push(`现状 L${record.previousCurrentLevel} → L${record.currentLevel}`);
  }
  if (record.previousTargetLevel !== record.targetLevel) {
    changes.push(`目标 L${record.previousTargetLevel} → L${record.targetLevel}`);
  }
  return changes.length > 0 ? changes.join('；') : '数值未变化';
}

export default function CompetencyChangeLogDialog({
  records,
  isLoading,
  error,
  onClose,
}: CompetencyChangeLogDialogProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="competency-change-log-title"
        className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 id="competency-change-log-title" className="text-xl font-bold text-gray-900">能力修改记录</h2>
            <p className="mt-1 text-sm text-gray-500">记录修改时间、修改内容和修改人员</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭修改记录" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />加载修改记录...
            </div>
          ) : error ? (
            <p className="p-6 text-red-700">{error}</p>
          ) : records.length === 0 ? (
            <p className="p-12 text-center text-gray-500">暂无修改记录</p>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">修改时间</th>
                  <th className="px-4 py-3 font-medium">人员</th>
                  <th className="px-4 py-3 font-medium">模块 / 能力</th>
                  <th className="px-4 py-3 font-medium">修改内容</th>
                  <th className="px-4 py-3 font-medium">修改人员</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(record => (
                  <tr key={record.id} className="align-top hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {record.changedAt ? new Date(record.changedAt).toLocaleString('zh-CN') : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{record.employeeName}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{record.moduleName}</div>
                      <div className="mt-1 text-xs text-gray-500">{record.skillName}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      <div>{formatChange(record)}</div>
                      {record.notes && <div className="mt-1 text-xs text-gray-500">说明：{record.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{record.changedByName || record.changedByEmail || '历史记录（人员未知）'}</div>
                      {record.changedByName && record.changedByEmail && (
                        <div className="mt-1 text-xs text-gray-500">{record.changedByEmail}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
