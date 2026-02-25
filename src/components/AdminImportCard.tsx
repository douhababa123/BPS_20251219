/**
 * Admin Import Card - 管理员数据导入卡片
 * 
 * 功能：
 * - 直接上传 CSV/Excel 到 Admin API 端点
 * - 显示上传进度
 * - 显示行级错误信息
 * - 下载导入模板
 */

import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Download, FileSpreadsheet, X } from 'lucide-react';
import { 
  importDepartmentsCSV, 
  importEmployeesCSV, 
  importSkillsCSV
} from '@/services/adminService';

type ImportTableType = 'departments' | 'employees' | 'skills';

interface ImportError {
  row: number;
  error: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
}

interface AdminImportCardProps {
  tableType: ImportTableType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  templateFields: string[];
}

export function AdminImportCard({
  tableType,
  title,
  description,
  icon,
  color,
  templateFields,
}: AdminImportCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // 验证文件类型
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const fileExt = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
      
      if (!validTypes.includes(fileExt)) {
        alert('请选择 CSV 或 Excel 文件（.csv, .xlsx, .xls）');
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setStatus('idle');
      setUploadProgress(0);
    }
  };

  // 上传文件
  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatus('idle');
    setUploadProgress(0);

    try {
      let uploadResult: ImportResult;

      // 根据表类型选择对应的导入函数
      if (tableType === 'departments') {
        uploadResult = await importDepartmentsCSV(file, (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        });
      } else if (tableType === 'employees') {
        uploadResult = await importEmployeesCSV(file, (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        });
      } else {
        uploadResult = await importSkillsCSV(file, (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        });
      }

      setResult(uploadResult);
      
      if (uploadResult.failed === 0) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (error: any) {
      setStatus('error');
      setResult({
        success: 0,
        failed: 1,
        errors: [{ row: 0, error: error.message || '上传失败' }]
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 下载模板
  const handleDownloadTemplate = () => {
    const csvContent = '\ufeff' + templateFields.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableType}_template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 清除文件
  const handleClear = () => {
    setFile(null);
    setResult(null);
    setStatus('idle');
    setUploadProgress(0);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-xl ${color}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          模板
        </button>
      </div>

      {/* File Upload Area */}
      <div className="space-y-4">
        {!file ? (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileSpreadsheet className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                点击选择文件或拖拽到此处
              </p>
              <p className="text-xs text-gray-500 mt-1">
                支持 CSV, Excel (.xlsx, .xls)
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
            />
          </label>
        ) : (
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              {!isUploading && (
                <button
                  onClick={handleClear}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>上传中...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            {!isUploading && !result && (
              <button
                onClick={handleUpload}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                开始导入
              </button>
            )}
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className={`rounded-xl p-4 ${
            status === 'success' ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
          }`}>
            <div className="flex items-start space-x-3">
              {status === 'success' ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className={`font-semibold mb-2 ${
                  status === 'success' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {status === 'success' ? '导入成功' : '导入完成（部分失败）'}
                </h4>
                <div className="text-sm space-y-1 mb-3">
                  <p className="text-green-800">✅ 成功: {result.success} 条</p>
                  {result.failed > 0 && (
                    <p className="text-red-800">❌ 失败: {result.failed} 条</p>
                  )}
                </div>

                {/* Error List */}
                {result.errors.length > 0 && (
                  <div className="bg-white rounded-lg p-3 mt-3">
                    <h5 className="font-semibold text-gray-900 mb-2">错误详情：</h5>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {result.errors.slice(0, 10).map((err, idx) => (
                        <div key={idx} className="text-xs text-gray-700 font-mono">
                          <span className="font-semibold text-red-600">行 {err.row}:</span> {err.error}
                        </div>
                      ))}
                      {result.errors.length > 10 && (
                        <p className="text-xs text-gray-500 italic">
                          ...还有 {result.errors.length - 10} 个错误未显示
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleClear}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  重新导入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Format Instructions */}
      <div className="mt-4 bg-gray-50 rounded-lg p-3">
        <h5 className="text-xs font-semibold text-gray-700 mb-1">📋 格式要求</h5>
        <ul className="text-xs text-gray-600 space-y-0.5">
          <li>• 第一行必须是表头（中文或英文字段名）</li>
          <li>• 支持 CSV (.csv) 和 Excel (.xlsx) 格式</li>
          <li>• CSV 必须使用 UTF-8 编码（避免乱码）</li>
          <li>• 必填字段不能为空，可选字段可留空</li>
        </ul>
      </div>
    </div>
  );
}
