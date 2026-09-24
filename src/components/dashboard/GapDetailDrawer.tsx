import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';
import {
  formatGap, getCompetencyProgressDetails,
  type CompetencyProgressPoint, type CompetencyProgressResponse,
} from '../../lib/dashboardProgressApi';

export function GapDetailDrawer({ progress, point, onClose }: {
  progress: CompetencyProgressResponse;
  point: CompetencyProgressPoint;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const detailQuery = useQuery({
    queryKey: ['competency-progress-details', progress.year, point.month, progress.moduleId, progress.employeeId],
    queryFn: () => getCompetencyProgressDetails(progress.year, point.month, progress.moduleId, progress.employeeId),
    retry: 1,
  });

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  const data = detailQuery.isFetching || detailQuery.isError ? undefined : detailQuery.data;
  const detailTotal = data?.details?.reduce((sum, item) => sum + item.gap, 0);
  const matchesBar = data?.status === 'ready'
    && data.year === progress.year
    && data.month === point.month
    && data.moduleId === progress.moduleId
    && (data.employeeId ?? '').toLowerCase() === (progress.employeeId ?? '').toLowerCase()
    && data.baselineId === progress.baselineId
    && data.kpis?.currentGap === point.gap
    && detailTotal === point.gap;
  const positiveDetails = matchesBar ? data.details!.filter(item => item.gap > 0) : [];

  return createPortal(
    <div className="fixed inset-0 z-50" data-testid="gap-detail-drawer">
      <button type="button" aria-label="关闭 GAP 明细" onClick={onClose} className="absolute inset-0 w-full bg-slate-950/40" tabIndex={-1} />
      <aside role="dialog" aria-modal="true" aria-labelledby="gap-detail-title" className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="gap-detail-title" className="text-lg font-semibold text-slate-900">{point.label} 技能 GAP 构成明细</h2>
            <p className="mt-1 text-sm text-slate-600">{point.isPartial ? '当月进行中，数据截至当前时间' : '历史月份，数据截至月末'} · 柱状图 GAP {formatGap(point.gap)}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭明细抽屉" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {(detailQuery.isPending || detailQuery.isFetching) && <p role="status" className="py-8 text-center text-slate-600">正在加载技能 GAP 明细…</p>}
          {detailQuery.isError && <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700"><AlertCircle className="h-4 w-4" />明细加载失败，请关闭后重试。</p>}
          {data && !matchesBar && <p role="alert" className="flex items-center gap-2 rounded-lg bg-amber-50 p-4 text-amber-800"><AlertCircle className="h-4 w-4" />数据已变化或与柱状图不一致，请刷新总览后重试。</p>}
          {matchesBar && (
            <>
              <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
                GAP 合计 <strong>{formatGap(detailTotal)}</strong> · {positiveDetails.length} 项有 GAP / {data.cellCount} 个基线单元
                {data.cutoff && <span className="block mt-1">统计截止：{data.cutoff.replace('T', ' ').slice(0, 19)}（北京时间）</span>}
              </div>
              {positiveDetails.length === 0 ? <p className="py-8 text-center text-slate-600">该月所有基线技能的 GAP 均为 0。</p> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[670px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-slate-700">
                      <tr><th scope="col" className="px-3 py-3">人员</th><th scope="col" className="px-3 py-3">能力模块</th><th scope="col" className="px-3 py-3">技能</th><th scope="col" className="px-3 py-3 text-right">现状</th><th scope="col" className="px-3 py-3 text-right">目标</th><th scope="col" className="px-3 py-3 text-right">GAP</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {positiveDetails.map(item => <tr key={`${item.employeeId}-${item.skillId}`}>
                        <td className="px-3 py-3">{item.employeeName}</td><td className="px-3 py-3">{item.moduleName}</td><td className="px-3 py-3">{item.skillName}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{item.currentLevel}</td><td className="px-3 py-3 text-right tabular-nums">{item.annualTarget}</td><td className="px-3 py-3 text-right font-semibold tabular-nums text-amber-800">{item.gap}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>, document.body,
  );
}
