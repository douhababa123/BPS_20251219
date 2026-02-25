import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, Database, ListTree, Calendar, Trash2, Download } from 'lucide-react';
import { parseComplexExcel, type ParseResult as AssessmentParseResult } from '../lib/complexExcelParser';
import { parseSkillDefinition, type SkillParseResult } from '../lib/skillDefinitionParser';
import { supabaseService } from '../lib/supabaseService';
import { importResourcePlanningExcelV2 } from '../lib/excelResourceParser_V2';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/utils';

type ImportType = 'skills' | 'assessments' | 'resource_planning';

export function ImportNew() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importType, setImportType] = useState<ImportType>('assessments');
  const [file, setFile] = useState<File | null>(null);
  const [skillResult, setSkillResult] = useState<SkillParseResult | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  
  // 资源规划相关状态
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [resourceImportResult, setResourceImportResult] = useState<{
    success: boolean;
    importedCount: number;
    errors: string[];
    warnings: string[];
    batchId: string;
  } | null>(null);

  // 获取资源规划任务类型
  const { data: taskTypes = [] } = useQuery({
    queryKey: ['resource-task-types'],
    queryFn: () => supabaseService.getAllResourceTaskTypes(),
    enabled: importType === 'resource_planning',
  });

  // 获取资源规划导入历史
  const { data: importBatches = [], refetch: refetchBatches } = useQuery({
    queryKey: ['import-batches'],
    queryFn: () => supabaseService.getImportBatches(),
    enabled: importType === 'resource_planning',
  });

  // 删除批次
  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: string) => supabaseService.deleteImportBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
    },
  });

  // 处理文件选择（原有功能）
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSkillResult(null);
      setAssessmentResult(null);
      setResourceImportResult(null);
      setUploadStatus('idle');
    }
  };

  // 解析Excel（原有功能 + 资源规划）
  const handleParse = async () => {
    if (!file) return;

    setIsLoading(true);
    setUploadStatus('idle');
    
    try {
      if (importType === 'skills') {
        const result = await parseSkillDefinition(file);
        setSkillResult(result);
        setAssessmentResult(null);
        
        if (!result.success) {
          setUploadStatus('error');
          setUploadMessage('解析失败，请查看下方错误详情');
        }
      } else if (importType === 'assessments') {
        const result = await parseComplexExcel(file);
        setAssessmentResult(result);
        setSkillResult(null);
        
        if (!result.success) {
          setUploadStatus('error');
          setUploadMessage('解析失败，请查看下方错误详情');
        }
      } else if (importType === 'resource_planning') {
        // 资源规划导入（V2版本：按天存储）
        const result = await importResourcePlanningExcelV2(file, selectedYear);
        setResourceImportResult(result);
        
        if (result.success) {
          setUploadStatus('success');
          setUploadMessage(`✅ 成功导入 ${result.importedCount} 条任务记录`);
          refetchBatches();
        } else {
          setUploadStatus('error');
          setUploadMessage('导入失败，请查看下方错误详情');
        }
      }
    } catch (error: any) {
      setUploadStatus('error');
      setUploadMessage('文件解析失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 确认导入（原有功能）
  const handleConfirm = async () => {
    setIsLoading(true);
    
    try {
      if (importType === 'skills' && skillResult?.skills) {
        const result = await supabaseService.upsertSkills(skillResult.skills);
        
        if (result.success) {
          setUploadStatus('success');
          setUploadMessage(`✅ 成功导入 ${result.count} 个能力定义`);
        } else {
          setUploadStatus('error');
          setUploadMessage('❌ 导入失败');
        }
      } else if (importType === 'assessments' && assessmentResult?.data) {
        const result = await supabaseService.importFromExcel(assessmentResult.data);
        
        if (result.success) {
          setUploadStatus('success');
          setUploadMessage(`✅ ${result.message}`);
        } else {
          setUploadStatus('error');
          setUploadMessage(`❌ ${result.message}`);
        }
      }
    } catch (error: any) {
      setUploadStatus('error');
      setUploadMessage(`❌ 导入失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 下载模板
  const handleDownloadTemplate = () => {
    const templateData = [
      ['姓名 Name', 'CW1', 'CW2', 'CW3', 'CW4', 'CW5', '...'],
      ['王宁', 'WS', '', 'P', 'P', '', ''],
      ['李华', '', 'T', 'T', '', 'M', ''],
      ['张三', 'C', 'C', 'C', '', '', ''],
    ];

    const csvContent = '\ufeff' + templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `资源规划模板_${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentResult = importType === 'skills' ? skillResult : (importType === 'assessments' ? assessmentResult : null);
  const hasData = importType === 'skills' ? !!skillResult?.skills.length : (importType === 'assessments' ? !!assessmentResult?.data : false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">数据导入中心</h1>
          <p className="text-gray-600 mt-2">选择导入类型并上传对应的Excel文件</p>
        </div>

        {/* 导入类型选择（3个大卡片）*/}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* 能力定义导入 */}
          <button
            onClick={() => {
              setImportType('skills');
              setFile(null);
              setSkillResult(null);
              setAssessmentResult(null);
              setResourceImportResult(null);
              setUploadStatus('idle');
            }}
            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
              importType === 'skills'
                ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg scale-105'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-3 rounded-xl ${
                importType === 'skills' ? 'bg-blue-600' : 'bg-blue-100'
              }`}>
                <ListTree className={`w-6 h-6 ${
                  importType === 'skills' ? 'text-white' : 'text-blue-600'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold mb-1 ${
                  importType === 'skills' ? 'text-blue-900' : 'text-gray-800'
                }`}>
                  📋 能力定义
                </h3>
                <p className="text-xs text-gray-600">
                  9大能力模块 + 39个能力类型
                </p>
              </div>
            </div>
            {importType === 'skills' && (
              <div className="absolute top-3 right-3">
                <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  已选择
                </div>
              </div>
            )}
          </button>

          {/* 能力评估导入 */}
          <button
            onClick={() => {
              setImportType('assessments');
              setFile(null);
              setSkillResult(null);
              setAssessmentResult(null);
              setResourceImportResult(null);
              setUploadStatus('idle');
            }}
            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
              importType === 'assessments'
                ? 'border-green-600 bg-gradient-to-br from-green-50 to-green-100 shadow-lg scale-105'
                : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-3 rounded-xl ${
                importType === 'assessments' ? 'bg-green-600' : 'bg-green-100'
              }`}>
                <FileSpreadsheet className={`w-6 h-6 ${
                  importType === 'assessments' ? 'text-white' : 'text-green-600'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold mb-1 ${
                  importType === 'assessments' ? 'text-green-900' : 'text-gray-800'
                }`}>
                  📊 能力评估
                </h3>
                <p className="text-xs text-gray-600">
                  员工能力评估数据（横向矩阵）
                </p>
              </div>
            </div>
            {importType === 'assessments' && (
              <div className="absolute top-3 right-3">
                <div className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  已选择
                </div>
              </div>
            )}
          </button>

          {/* 资源规划导入 - 新增 */}
          <button
            onClick={() => {
              setImportType('resource_planning');
              setFile(null);
              setSkillResult(null);
              setAssessmentResult(null);
              setResourceImportResult(null);
              setUploadStatus('idle');
            }}
            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
              importType === 'resource_planning'
                ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-purple-100 shadow-lg scale-105'
                : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-3 rounded-xl ${
                importType === 'resource_planning' ? 'bg-purple-600' : 'bg-purple-100'
              }`}>
                <Calendar className={`w-6 h-6 ${
                  importType === 'resource_planning' ? 'text-white' : 'text-purple-600'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold mb-1 ${
                  importType === 'resource_planning' ? 'text-purple-900' : 'text-gray-800'
                }`}>
                  📅 资源规划
                </h3>
                <p className="text-xs text-gray-600">
                  工程师任务规划（周度视图）
                </p>
              </div>
            </div>
            {importType === 'resource_planning' && (
              <div className="absolute top-3 right-3">
                <div className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  已选择
                </div>
              </div>
            )}
          </button>
        </div>

        {/* 资源规划特殊配置（仅在选择资源规划时显示）*/}
        {importType === 'resource_planning' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">资源规划导入设置</h3>
                <p className="text-sm text-gray-600">选择年份并上传Excel文件</p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                下载模板
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  选择年份 Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={year} value={year}>
                        {year}年
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  任务类型（{taskTypes.length}种）
                </label>
                <div className="flex flex-wrap gap-1">
                  {taskTypes.slice(0, 8).map((type: any) => (
                    <span
                      key={type.id}
                      className="px-2 py-1 text-xs rounded"
                      style={{ 
                        backgroundColor: type.color_hex + '20',
                        color: type.color_hex
                      }}
                    >
                      {type.code}
                    </span>
                  ))}
                  {taskTypes.length > 8 && (
                    <span className="px-2 py-1 text-xs text-gray-500">
                      +{taskTypes.length - 8}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 说明文档 */}
            <div className="bg-purple-50 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-purple-900 mb-2">📖 Excel格式要求</h4>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• 第1行：姓名 | CW1 | CW2 | CW3 | ...</li>
                <li>• 第2行起：员工姓名 + 每周任务类型代码</li>
                <li>• 支持合并单元格（连续相同任务自动识别为跨周任务）</li>
                <li>• 追加模式：每次导入追加新记录，显示最新版本</li>
              </ul>
            </div>
          </div>
        )}

        {/* Excel格式说明（原有功能）*/}
        {(importType === 'skills' || importType === 'assessments') && (
          <div className={`border-2 rounded-xl p-6 mb-6 transition-all ${
            importType === 'skills' 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start space-x-3">
              <FileSpreadsheet className={`w-6 h-6 flex-shrink-0 mt-1 ${
                importType === 'skills' ? 'text-blue-600' : 'text-green-600'
              }`} />
              <div className="flex-1">
                <h3 className={`font-bold text-lg mb-3 ${
                  importType === 'skills' ? 'text-blue-900' : 'text-green-900'
                }`}>
                  {importType === 'skills' ? '📋 能力定义Excel格式' : '📊 能力评估Excel格式'}
                </h3>
                
                {importType === 'skills' ? (
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2">表头结构：</h4>
                      <ul className="space-y-1.5 text-sm text-blue-800">
                        <li>• 第1行：编号 | 模块 | 类型 | 工程师</li>
                        <li>• 第2行起：数据行（每行一个能力类型）</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-2">表头结构（横向矩阵）：</h4>
                      <ul className="space-y-1.5 text-sm text-green-800">
                        <li>• 第1-3行：分类表头（可选）</li>
                        <li>• 第4行：技能名称</li>
                        <li>• 第5行：C/T标记</li>
                        <li>• 第6行起：数据行（每行一个员工）</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 文件上传区域 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 hover:border-blue-400 transition-colors">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className={`p-6 rounded-full ${
                importType === 'skills' ? 'bg-blue-100' : 
                importType === 'assessments' ? 'bg-green-100' : 
                'bg-purple-100'
              }`}>
                <Upload className={`w-12 h-12 ${
                  importType === 'skills' ? 'text-blue-600' : 
                  importType === 'assessments' ? 'text-green-600' : 
                  'text-purple-600'
                }`} />
              </div>
              
              <div className="text-center">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className={`text-lg font-semibold hover:opacity-80 ${
                    importType === 'skills' ? 'text-blue-600' : 
                    importType === 'assessments' ? 'text-green-600' : 
                    'text-purple-600'
                  }`}>
                    点击选择文件
                  </span>
                  <span className="text-gray-600"> 或拖拽文件到此处</span>
                </label>
                <p className="text-sm text-gray-500 mt-2">支持 .xlsx, .xls, .csv 格式</p>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  ref={fileInputRef}
                />
              </div>

              {file && (
                <div className="flex items-center space-x-3 px-6 py-3 bg-gray-100 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}

              <button
                onClick={handleParse}
                disabled={!file || isLoading}
                className={`px-8 py-3 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2 shadow-md ${
                  importType === 'skills' ? 'bg-blue-600' : 
                  importType === 'assessments' ? 'bg-green-600' : 
                  'bg-purple-600'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{importType === 'resource_planning' ? '导入中...' : '解析中...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>{importType === 'resource_planning' ? '开始导入' : '开始解析'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 资源规划导入结果 */}
        {importType === 'resource_planning' && resourceImportResult && (
          <div className={cn(
            'rounded-2xl p-6 shadow-sm border mb-6',
            resourceImportResult.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          )}>
            <div className="flex items-start gap-3">
              {resourceImportResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className={cn(
                  'font-semibold mb-2',
                  resourceImportResult.success ? 'text-green-900' : 'text-red-900'
                )}>
                  {resourceImportResult.success ? '导入成功！' : '导入失败'}
                </h3>
                {resourceImportResult.success && (
                  <p className="text-green-800 mb-3">
                    成功导入 <strong>{resourceImportResult.importedCount}</strong> 条任务记录
                  </p>
                )}

                {resourceImportResult.errors.length > 0 && (
                  <div className="mt-3 bg-white rounded-lg p-3">
                    <h4 className="font-medium text-red-900 mb-2">❌ 错误：</h4>
                    <ul className="text-sm text-red-800 space-y-1">
                      {resourceImportResult.errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {resourceImportResult.warnings.length > 0 && (
                  <div className="mt-3 bg-white rounded-lg p-3">
                    <h4 className="font-medium text-amber-900 mb-2">⚠️ 警告：</h4>
                    <ul className="text-sm text-amber-800 space-y-1">
                      {resourceImportResult.warnings.slice(0, 10).map((warning, idx) => (
                        <li key={idx}>• {warning}</li>
                      ))}
                      {resourceImportResult.warnings.length > 10 && (
                        <li className="text-amber-600">
                          ... 还有 {resourceImportResult.warnings.length - 10} 条警告
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 导入历史（仅资源规划）*/}
        {importType === 'resource_planning' && importBatches.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">导入历史 Import History</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">文件名</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">导入时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">任务数量</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {importBatches.slice(0, 5).map((batch: any) => (
                    <tr key={batch.batchId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{batch.fileName}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(batch.importedAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">{batch.count} 条</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`确定要删除批次 "${batch.fileName}" 吗？`)) {
                              deleteBatchMutation.mutate(batch.batchId);
                            }
                          }}
                          disabled={deleteBatchMutation.isPending}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 解析结果（原有功能）*/}
        {currentResult && importType !== 'resource_planning' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              {currentResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
              解析结果
            </h2>

            {/* 统计信息 */}
            {importType === 'skills' && skillResult && (
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-blue-600 text-sm font-medium mb-1">能力总数</div>
                      <div className="text-3xl font-bold text-blue-900">{skillResult.summary.total}</div>
                    </div>
                    <Database className="w-12 h-12 text-blue-400" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-purple-600 text-sm font-medium mb-1">模块数</div>
                      <div className="text-3xl font-bold text-purple-900">{skillResult.summary.modules}</div>
                    </div>
                    <ListTree className="w-12 h-12 text-purple-400" />
                  </div>
                </div>
              </div>
            )}

            {importType === 'assessments' && assessmentResult && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                  <div className="text-blue-600 text-xs font-medium mb-1">部门数</div>
                  <div className="text-2xl font-bold text-blue-900">{assessmentResult.summary.departments}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                  <div className="text-green-600 text-xs font-medium mb-1">员工数</div>
                  <div className="text-2xl font-bold text-green-900">{assessmentResult.summary.employees}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                  <div className="text-purple-600 text-xs font-medium mb-1">技能数</div>
                  <div className="text-2xl font-bold text-purple-900">{assessmentResult.summary.skills}</div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200">
                  <div className="text-amber-600 text-xs font-medium mb-1">评估数</div>
                  <div className="text-2xl font-bold text-amber-900">{assessmentResult.summary.assessments}</div>
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {currentResult.errors && currentResult.errors.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 mb-6">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h3 className="font-bold text-red-900">
                    发现 {currentResult.errors.length} 个错误
                  </h3>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {currentResult.errors.map((error: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg p-3 text-sm text-red-800 border border-red-200">
                      {error.row && <span className="font-bold">第{error.row}行</span>}
                      {error.field && <span className="font-semibold text-red-700"> [{error.field}]</span>}
                      {': '}
                      {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 确认按钮 */}
            {hasData && (
              <button
                onClick={handleConfirm}
                disabled={isLoading || !currentResult.success}
                className={`w-full px-8 py-4 text-white text-lg font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 shadow-lg ${
                  importType === 'skills' ? 'bg-blue-600' : 'bg-green-600'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>导入中...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>确认导入到数据库</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* 上传状态消息 */}
        {uploadStatus !== 'idle' && (
          <div className={`rounded-xl p-6 shadow-lg ${
            uploadStatus === 'success' 
              ? 'bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300' 
              : 'bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300'
          }`}>
            <div className="flex items-center space-x-3 mb-4">
              {uploadStatus === 'success' ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-600" />
              )}
              <span className={`text-lg font-semibold ${
                uploadStatus === 'success' ? 'text-green-900' : 'text-red-900'
              }`}>
                {uploadMessage}
              </span>
            </div>
            
            {uploadStatus === 'success' && (
              <button
                onClick={() => {
                  setFile(null);
                  setSkillResult(null);
                  setAssessmentResult(null);
                  setResourceImportResult(null);
                  setUploadStatus('idle');
                  setUploadMessage('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                继续导入
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
