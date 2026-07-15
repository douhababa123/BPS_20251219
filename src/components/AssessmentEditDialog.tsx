import { useEffect, useMemo, useRef, useState } from 'react';

import type { AssessmentSaveInput } from '../lib/database.types';


interface AssessmentEditDialogProps {
  employeeName: string;
  skillName: string;
  initial?: AssessmentSaveInput;
  onCancel: () => void;
  onSave: (input: AssessmentSaveInput) => Promise<void>;
}

type LevelValue = number | '';
const LEVELS = [0, 1, 2, 3, 4] as const;

export default function AssessmentEditDialog({
  employeeName,
  skillName,
  initial,
  onCancel,
  onSave,
}: AssessmentEditDialogProps) {
  const [current, setCurrent] = useState<LevelValue>(initial?.current_level ?? '');
  const [target, setTarget] = useState<LevelValue>(initial?.target_level ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const currentRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    currentRef.current?.focus();
  }, []);

  const targetOptions = useMemo(
    () => current === ''
      ? []
      : LEVELS.filter(level => level >= current),
    [current],
  );

  const handleCurrentChange = (value: string) => {
    const next = value === '' ? '' : Number(value);
    setCurrent(next);
    if (next !== '' && target !== '' && target < next) {
      setTarget('');
      setError('请重新选择不低于现状的能力目标');
    } else {
      setError(null);
    }
  };

  const handleTargetChange = (value: string) => {
    setTarget(value === '' ? '' : Number(value));
    setError(null);
  };

  const canSave = typeof current === 'number'
    && typeof target === 'number'
    && target >= current
    && current <= 4
    && target <= 4
    && !isSaving;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || typeof current !== 'number' || typeof target !== 'number') return;

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        current_level: current,
        target_level: target,
        notes: notes.trim() || undefined,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !isSaving) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-dialog-title"
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
      >
        <form onSubmit={submit}>
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 id="assessment-dialog-title" className="text-lg font-semibold text-gray-900">
              编辑能力评估
            </h2>
            <p className="mt-1 text-sm text-gray-500">修改将保存到季度历史记录</p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm">
              <div>
                <div className="text-gray-500">员工</div>
                <div className="mt-1 font-medium text-gray-900">{employeeName}</div>
              </div>
              <div>
                <div className="text-gray-500">能力项</div>
                <div className="mt-1 font-medium text-gray-900">{skillName}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm font-medium text-gray-700">
                能力现状 <span className="text-red-600">*</span>
                <select
                  ref={currentRef}
                  aria-label="能力现状"
                  value={current}
                  disabled={isSaving}
                  onChange={event => handleCurrentChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
                >
                  <option value="">请选择</option>
                  {LEVELS.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-700">
                能力目标 <span className="text-red-600">*</span>
                <select
                  aria-label="能力目标"
                  value={target}
                  disabled={current === '' || isSaving}
                  onChange={event => handleTargetChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
                >
                  <option value="">请选择</option>
                  {targetOptions.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium text-gray-700">
              备注
              <textarea
                aria-label="备注"
                value={notes}
                maxLength={2000}
                disabled={isSaving}
                onChange={event => setNotes(event.target.value)}
                rows={3}
                className="mt-2 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
                placeholder="可选：填写本次调整说明"
              />
            </label>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSaving ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
