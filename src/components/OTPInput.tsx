import { useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { cn } from '../lib/utils';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
  className?: string;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  onComplete,
  className,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 初始化输入框引用
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  // 自动聚焦第一个输入框
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // 监听值变化，自动完成时触发回调
  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const handleChange = (index: number, inputValue: string) => {
    // 只允许数字
    const digit = inputValue.replace(/[^0-9]/g, '');
    
    if (digit.length > 1) {
      // 如果粘贴了多个字符，处理粘贴逻辑
      handlePaste(index, digit);
      return;
    }

    // 更新值
    const newValue = value.split('');
    newValue[index] = digit;
    const updatedValue = newValue.join('');
    onChange(updatedValue);

    // 自动跳转到下一个输入框
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    // 退格键：删除当前字符并跳转到上一个输入框
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newValue = value.split('');
      
      if (newValue[index]) {
        // 如果当前有值，删除当前值
        newValue[index] = '';
        onChange(newValue.join(''));
      } else if (index > 0) {
        // 如果当前没有值，删除上一个值并跳转
        newValue[index - 1] = '';
        onChange(newValue.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    }

    // 左箭头：跳转到上一个输入框
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }

    // 右箭头：跳转到下一个输入框
    if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (startIndex: number, pastedData: string) => {
    const digits = pastedData.replace(/[^0-9]/g, '').slice(0, length);
    const newValue = value.split('');
    
    for (let i = 0; i < digits.length && startIndex + i < length; i++) {
      newValue[startIndex + i] = digits[i];
    }
    
    onChange(newValue.join(''));

    // 聚焦到最后一个填充的输入框
    const lastFilledIndex = Math.min(startIndex + digits.length - 1, length - 1);
    inputRefs.current[lastFilledIndex]?.focus();
  };

  const handlePasteEvent = (e: ClipboardEvent<HTMLInputElement>, index: number) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    handlePaste(index, pastedData);
  };

  const handleFocus = (index: number) => {
    // 聚焦时选中当前内容
    inputRefs.current[index]?.select();
  };

  return (
    <div className={cn('flex gap-2 justify-center', className)}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePasteEvent(e, index)}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          className={cn(
            'w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
            'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60',
            value[index] ? 'border-blue-500 bg-blue-50' : 'border-gray-300',
            'hover:border-blue-400'
          )}
          aria-label={`验证码第 ${index + 1} 位`}
        />
      ))}
    </div>
  );
}

