import { useState, useEffect } from 'react';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { validateEmailDomain } from '../lib/authService';

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function EmailInput({
  value,
  onChange,
  onValidationChange,
  placeholder = '请输入邮箱地址',
  disabled = false,
  autoFocus = false,
  className,
}: EmailInputProps) {
  const [touched, setTouched] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message?: string }>({ valid: true });

  // 验证邮箱
  useEffect(() => {
    if (!value || !touched) {
      setValidationResult({ valid: true });
      onValidationChange?.(false);
      return;
    }

    const result = validateEmailDomain(value);
    setValidationResult(result);
    onValidationChange?.(result.valid);
  }, [value, touched, onValidationChange]);

  const handleBlur = () => {
    setTouched(true);
  };

  const showError = touched && !validationResult.valid;
  const showSuccess = touched && validationResult.valid && value.length > 0;

  return (
    <div className={cn('w-full', className)}>
      <div className="relative">
        {/* 邮箱图标 */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Mail className="w-5 h-5" />
        </div>

        {/* 输入框 */}
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="email"
          className={cn(
            'w-full pl-10 pr-10 py-3 rounded-lg border-2 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60',
            showError && 'border-red-500 focus:border-red-500',
            showSuccess && 'border-green-500 focus:border-green-500',
            !showError && !showSuccess && 'border-gray-300 focus:border-blue-500'
          )}
        />

        {/* 状态图标 */}
        {touched && value && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {showError && <AlertCircle className="w-5 h-5 text-red-500" />}
            {showSuccess && <CheckCircle className="w-5 h-5 text-green-500" />}
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {showError && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {validationResult.message}
        </p>
      )}

      {/* 成功提示 */}
      {showSuccess && (
        <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          邮箱格式正确
        </p>
      )}

      {/* 提示信息 */}
      {!touched && (
        <p className="mt-2 text-sm text-gray-500">
          请使用 @bosch.com 或 @bshg.com 邮箱
        </p>
      )}
    </div>
  );
}

