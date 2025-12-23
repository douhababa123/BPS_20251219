import { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Download, ChevronRight, Database, Users, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ImportType } from '../lib/types';
import { ExcelParser, type ParseError } from '../lib/excelParser';
import { supabaseService } from '../lib/supabaseService';

type Step = 'select-type' | 'upload' | 'parse' | 'errors' | 'confirm';

export function ImportNew() {
  const [currentStep, setCurrentStep] = useState<Step>('select-type');
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ count: number } | null>(null);

  const steps = importType === 'competency_definition' ? [
    { id: 'select-type', label: '选择类型', sublabel: 'Select Type' },
    { id: 'upload', label: '选择文件', sublabel: 'Select File' },
    { id: 'parse', label: '数据预览', sublabel: 'Preview' },
    { id: 'confirm', label: '确认导入', sublabel: 'Confirm' },
  ] : [
    { id: 'select-type', label: '选择类型', sublabel: 'Select Type' },
    { id: 'upload', label: '选择文件', sublabel: 'Select File' },
    { id: 'parse', label: '试运行解析', sublabel: 'Parse Preview' },
    { id: 'errors', label: '错误清单', sublabel: 'Error List' },
    { id: 'confirm', label: '确认入库', sublabel: 'Confirm Import' },
  ];

  const getCurrentStepIndex = () => steps.findIndex(s => s.id === currentStep);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      // 重置之前的状态
      setParseErrors([]);
      setParsedData([]);
      setUploadStats(null);
    }
  };

  const handleParse = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      if (importType === 'competency_definition') {
        // 解析能力定义表
        const result = await ExcelParser.parseCompetencyDefinitions(file);
        
        if (result.success) {
          setParsedData(result.data.slice(0, 5)); // 预览前5条
          setParseErrors([]);
          setCurrentStep('parse');
        } else {
          setParseErrors(result.errors);
          setParsedData([]);
          setCurrentStep('parse');
        }
      } else {
        // 解析能力评估表
        const result = await ExcelParser.parseCompetencyAssessments(file);
        
        if (result.success) {
          setParsedData(result.data.slice(0, 10)); // 预览前10条
          setParseErrors([]);
          setCurrentStep('parse');
        } else {
          setParseErrors(result.errors);
          setParsedData(result.data.slice(0, 10)); // 即使有错误也显示部分数据
          setCurrentStep('parse');
        }
      }
    } catch (error) {
      setParseErrors([{
        row: 0,
        message: `解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }]);
      setCurrentStep('parse');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      if (importType === 'competency_definition') {
        // 重新解析完整数据
        const result = await ExcelParser.parseCompetencyDefinitions(file);
        
        if (!result.success) {
          alert('数据包含错误，无法导入。请修复错误后重试。');
          return;
        }

        // 上传到Supabase（覆盖模式）
        const uploadResult = await supabaseService.upsertCompetencyDefinitions(
          result.data,
          true // 清空旧数据
        );

        setUploadStats({ count: uploadResult.count });
        setCurrentStep('confirm');
      } else {
        // 重新解析完整数据
        const result = await ExcelParser.parseCompetencyAssessments(file);
        
        if (!result.success) {
          alert('数据包含错误，无法导入。请修复错误后重试。');
          return;
        }

        // 上传到Supabase（覆盖模式）
        const uploadResult = await supabaseService.upsertCompetencyAssessments(
          result.data,
          true // 清空旧数据
        );

        setUploadStats({ count: uploadResult.count });
        setCurrentStep('confirm');
      }
    } catch (error) {
      alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDefinitionTemplate = () => {
    const template = `编号,能力模块,能力类型,工程师
1,TPM基础,TPM八大支柱,Zhang Wei
2,TPM基础,OEE计算与分析,Li Na
3,TPM基础,自主保全体系,Chen Ming
4,精益流程,价值流分析,Wang Pei
5,精益流程,流程映射技术,Liu Yang`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'competency-definition-template.csv';
    a.click();
  };

  const downloadAssessmentTemplate = () => {
    const template = `部门,姓名,能力模块,能力类型,现状得分,目标得分,评估年度
Quality Team,Zhang Wei,TPM基础,TPM八大支柱,2,4,2025
Quality Team,Zhang Wei,TPM基础,OEE计算与分析,3,4,2025
Process Engineering,Li Na,精益流程,价值流分析,3,5,2025`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'competency-assessment-template.csv';
    a.click();
  };

  const downloadErrorList = () => {
    const headers = ['Row', 'Field', 'Error Message', 'Actual Value'];
    const rows = parseErrors.map(e => [
      e.row,
      e.field || '',
      e.message,
      e.actualValue !== undefined ? String(e.actualValue) : ''
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
  };

  const resetImport = () => {
    setCurrentStep('select-type');
    setImportType(null);
    setFile(null);
    setParseErrors([]);
    setParsedData([]);
    setUploadStats(null);
  };

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isPast = index < getCurrentStepIndex();
            const isFuture = index > getCurrentStepIndex();

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center font-bold mb-2 transition-colors',
                      isActive && 'bg-blue-900 text-white',
                      isPast && 'bg-green-600 text-white',
                      isFuture && 'bg-gray-200 text-gray-500'
                    )}
                  >
                    {isPast ? <CheckCircle className="w-6 h-6" /> : index + 1}
                  </div>
                  <p className={cn('text-sm font-medium', isActive ? 'text-gray-900' : 'text-gray-600')}>
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-500">{step.sublabel}</p>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className={cn('w-5 h-5 -mt-8', isPast ? 'text-green-600' : 'text-gray-300')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 选择导入类型 */}
      {currentStep === 'select-type' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">选择导入类型 Select Import Type</h3>
          <div className="grid grid-cols-2 gap-6">
            <button
              onClick={() => {
                setImportType('competency_definition');
                setCurrentStep('upload');
              }}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <Database className="w-12 h-12 text-blue-600 mb-4 mx-auto" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">能力定义表</h4>
              <p className="text-sm text-gray-600 mb-4">Competency Definition</p>
              <div className="text-left space-y-1 text-xs text-gray-500">
                <p>• 9大能力模块</p>
                <p>• 39种能力类型</p>
                <p>• 对应工程师名称</p>
                <p>• 定义能力体系结构</p>
              </div>
            </button>

            <button
              onClick={() => {
                setImportType('competency_assessment');
                setCurrentStep('upload');
              }}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <Users className="w-12 h-12 text-green-600 mb-4 mx-auto" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">能力评估表</h4>
              <p className="text-sm text-gray-600 mb-4">Competency Assessment</p>
              <div className="text-left space-y-1 text-xs text-gray-500">
                <p>• 工程师能力水平</p>
                <p>• 现状得分 (C)</p>
                <p>• 目标得分 (T)</p>
                <p>• 自动计算差距值</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 上传文件 */}
      {currentStep === 'upload' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {importType === 'competency_definition' ? '导入能力定义' : '导入能力评估'} Import Template
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please use the following template format for importing data
            </p>
            
            {importType === 'competency_definition' ? (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-gray-900 mb-2">必填字段 Required Fields:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>• 编号 (Number)</div>
                  <div>• 能力模块 (Module)</div>
                  <div>• 能力类型 (Type)</div>
                  <div>• 工程师 (Engineer)</div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-gray-900 mb-2">必填字段 Required Fields:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>• 部门 (Department)</div>
                  <div>• 姓名 (Name)</div>
                  <div>• 能力模块 (Module)</div>
                  <div>• 能力类型 (Type)</div>
                  <div>• 现状得分 (Current Score: 1-5)</div>
                  <div>• 目标得分 (Target Score: ≥ Current)</div>
                  <div>• 评估年度 (Year)</div>
                </div>
                <div className="mt-4 p-3 bg-white rounded border border-green-300">
                  <h5 className="font-medium text-gray-800 mb-2">能力级别说明 Level Description:</h5>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>• Level 1: Know it - 了解概念</div>
                    <div>• Level 2: Do it - 能够执行</div>
                    <div>• Level 3: Lead it - 能够领导</div>
                    <div>• Level 4: Shape it - 能够塑造和优化</div>
                    <div>• Level 5: Master - 大师级别（隐含）</div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-300">
                  <h5 className="font-medium text-gray-800 mb-2">⚠️ 重要提示 Important Notes:</h5>
                  <div className="space-y-1 text-xs text-gray-700">
                    <div>• 请确保Excel前4-5行为标题说明，系统会自动跳过</div>
                    <div>• 避免在数据区域使用合并单元格</div>
                    <div>• 目标得分可以等于现状得分（表示已达标）</div>
                    <div>• C列=现状得分，T列=目标得分</div>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={importType === 'competency_definition' ? downloadDefinitionTemplate : downloadAssessmentTemplate}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              下载模板 Download Template
            </button>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              上传CSV/Excel文件 Upload File
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Drag and drop your file here, or click to browse
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
            >
              选择文件 Choose File
            </label>
            {file && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-600">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button
                  onClick={handleParse}
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      解析中...
                    </>
                  ) : (
                    '下一步 Next'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 解析结果 */}
      {currentStep === 'parse' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">解析结果 Parse Results</h3>

          {parseErrors.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">发现 {parseErrors.length} 个错误</p>
                  <p className="text-sm text-amber-700">Found {parseErrors.length} errors that need correction</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Row</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Field</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Error Message</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actual Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {parseErrors.map((error, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{error.row}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{error.field || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{error.message}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {error.actualValue !== undefined ? String(error.actualValue) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={downloadErrorList}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载错误清单 Download Errors
                </button>
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors"
                >
                  重新上传 Re-upload
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">解析成功 Parse Successful</p>
                  <p className="text-sm text-green-700">All data validated successfully, ready to import</p>
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">预览统计 Preview Statistics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">解析记录数 Parsed Records</p>
                    <p className="text-2xl font-bold text-gray-900">{parsedData.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">数据状态 Status</p>
                    <p className="text-lg font-bold text-green-600">✓ Ready</p>
                  </div>
                </div>
              </div>

              {/* 数据预览表格 */}
              {parsedData.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-700">
                      数据预览 (显示前 {parsedData.length} 条)
                    </p>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {Object.keys(parsedData[0] || {}).map((key) => (
                            <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {parsedData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {Object.values(item).map((value: any, i) => (
                              <td key={i} className="px-4 py-2 text-xs text-gray-900 whitespace-nowrap">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    ⚠️ 注意：点击确认后，将<strong>覆盖</strong>数据库中的所有旧数据！
                  </p>
                </div>
                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    '确认导入 Confirm Import'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 确认成功 */}
      {currentStep === 'confirm' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div className="text-center py-12">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">导入成功 Import Successful</h3>
            <p className="text-gray-600 mb-2">
              {importType === 'competency_definition' 
                ? 'Competency definitions have been successfully imported'
                : 'Assessment data has been successfully imported and gaps calculated'}
            </p>
            {uploadStats && (
              <p className="text-lg font-semibold text-blue-600 mb-6">
                成功导入 {uploadStats.count} 条记录
              </p>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={resetImport}
                className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors"
              >
                导入其他数据 Import More Data
              </button>
              <button
                onClick={() => window.location.href = '#/competency-assessment'}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                查看评估数据 View Assessments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
