import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, Database } from 'lucide-react';
import { parseComplexExcel, type ParseResult as AssessmentParseResult } from '../lib/complexExcelParser';
import { parseSkillDefinition, type SkillParseResult } from '../lib/skillDefinitionParser';
import { supabaseService } from '../lib/supabaseService';

type ImportType = 'skills' | 'assessments';

export function Import() {
  const [importType, setImportType] = useState<ImportType>('assessments');
  const [file, setFile] = useState<File | null>(null);
  const [skillResult, setSkillResult] = useState<SkillParseResult | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSkillResult(null);
      setAssessmentResult(null);
      setUploadStatus('idle');
    }
  };

  // 解析Excel
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
      } else {
        const result = await parseComplexExcel(file);
        setAssessmentResult(result);
        setSkillResult(null);
        
        if (!result.success) {
          setUploadStatus('error');
          setUploadMessage('解析失败，请查看下方错误详情');
        }
      }
    } catch (error: any) {
      setUploadStatus('error');
      setUploadMessage('文件解析失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 确认导入
  const handleConfirm = async () => {
    setIsLoading(true);
    
    try {
      if (importType === 'skills' && skillResult?.skills) {
        // 导入能力定义
        const result = await supabaseService.upsertSkills(skillResult.skills);
        
        if (result.success) {
          setUploadStatus('success');
          setUploadMessage(`成功导入 ${result.count} 个能力定义`);
        } else {
          setUploadStatus('error');
          setUploadMessage('导入失败');
        }
      } else if (importType === 'assessments' && assessmentResult?.data) {
        // 导入能力评估
        const result = await supabaseService.importFromExcel(assessmentResult.data);
        
        if (result.success) {
          setUploadStatus('success');
          setUploadMessage(result.message);
        } else {
          setUploadStatus('error');
          setUploadMessage(result.message);
        }
      }
    } catch (error: any) {
      setUploadStatus('error');
      setUploadMessage(`导入失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const currentResult = importType === 'skills' ? skillResult : assessmentResult;
  const hasData = importType === 'skills' ? !!skillResult?.skills.length : !!assessmentResult?.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">数据导入</h1>
          <p className="text-gray-600 mt-2">选择导入类型并上传Excel文件</p>
        </div>

        {/* 导入类型选择 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">选择导入类型</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 能力定义导入 */}
            <button
              onClick={() => {
                setImportType('skills');
                setFile(null);
                setSkillResult(null);
                setAssessmentResult(null);
                setUploadStatus('idle');
              }}
              className={`p-6 rounded-lg border-2 transition-all ${
                importType === 'skills'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start space-x-3">
                <Database className={`w-6 h-6 flex-shrink-0 ${
                  importType === 'skills' ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <div className="text-left">
                  <h3 className={`font-semibold ${
                    importType === 'skills' ? 'text-blue-900' : 'text-gray-700'
                  }`}>能力定义导入</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    导入9大能力模块和39个能力类型定义
                  </p>
                </div>
              </div>
            </button>

            {/* 能力评估导入 */}
            <button
              onClick={() => {
                setImportType('assessments');
                setFile(null);
                setSkillResult(null);
                setAssessmentResult(null);
                setUploadStatus('idle');
              }}
              className={`p-6 rounded-lg border-2 transition-all ${
                importType === 'assessments'
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-start space-x-3">
                <FileSpreadsheet className={`w-6 h-6 flex-shrink-0 ${
                  importType === 'assessments' ? 'text-green-600' : 'text-gray-400'
                }`} />
                <div className="text-left">
                  <h3 className={`font-semibold ${
                    importType === 'assessments' ? 'text-green-900' : 'text-gray-700'
                  }`}>能力评估导入</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    导入员工的能力评估数据（横向矩阵格式）
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Excel格式说明 */}
        <div className={`border rounded-lg p-6 mb-6 ${
          importType === 'skills' 
            ? 'bg-blue-50 border-blue-200' 
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start space-x-3">
            <FileSpreadsheet className={`w-6 h-6 flex-shrink-0 mt-1 ${
              importType === 'skills' ? 'text-blue-600' : 'text-green-600'
            }`} />
            <div className="flex-1">
              <h3 className={`font-semibold mb-2 ${
                importType === 'skills' ? 'text-blue-900' : 'text-green-900'
              }`}>Excel格式要求</h3>
              
              {importType === 'skills' ? (
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• 第1行：标题行（编号、模块、类型、工程师）</li>
                  <li>• 第2行起：数据行</li>
                  <li>• <strong>模块</strong>：9大能力名称（如：BPS elements）</li>
                  <li>• <strong>类型</strong>：具体能力名称（如：BPS System approach）</li>
                  <li>• <strong>工程师</strong>：负责人姓名（可选）</li>
                </ul>
              ) : (
                <ul className="space-y-1 text-sm text-green-800">
                  <li>• 第1-3行：多层分类表头（可选）</li>
                  <li>• 第4行：技能名称</li>
                  <li>• 第5行：C/T标记（Current/Target）</li>
                  <li>• 第6行起：数据行（每行一个员工）</li>
                  <li>• 前2列：Department（部门）、Name（姓名）</li>
                  <li>• 其余列：每个技能两列（C和T）</li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* 文件上传区域 */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Upload className="w-16 h-16 text-gray-400" />
              
              <div className="text-center">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className={`font-medium hover:opacity-80 ${
                    importType === 'skills' ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    点击选择文件
                  </span>
                  <span className="text-gray-600"> 或拖拽文件到此处</span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {file && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{file.name}</span>
                </div>
              )}

              <button
                onClick={handleParse}
                disabled={!file || isLoading}
                className={`px-6 py-3 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2 ${
                  importType === 'skills' ? 'bg-blue-600' : 'bg-green-600'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>解析中...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>解析文件</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 解析结果 */}
        {currentResult && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <h2 className="text-xl font-semibold mb-4">解析结果</h2>

            {/* 统计信息 */}
            {importType === 'skills' && skillResult && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-blue-600 text-sm">能力总数</div>
                  <div className="text-2xl font-bold text-blue-900">{skillResult.summary.total}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-purple-600 text-sm">模块数</div>
                  <div className="text-2xl font-bold text-purple-900">{skillResult.summary.modules}</div>
                </div>
              </div>
            )}

            {importType === 'assessments' && assessmentResult && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-blue-600 text-sm">部门数</div>
                  <div className="text-2xl font-bold text-blue-900">{assessmentResult.summary.departments}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-green-600 text-sm">员工数</div>
                  <div className="text-2xl font-bold text-green-900">{assessmentResult.summary.employees}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-purple-600 text-sm">技能数</div>
                  <div className="text-2xl font-bold text-purple-900">{assessmentResult.summary.skills}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <div className="text-amber-600 text-sm">评估数</div>
                  <div className="text-2xl font-bold text-amber-900">{assessmentResult.summary.assessments}</div>
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {currentResult.errors && currentResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-red-900">
                    发现 {currentResult.errors.length} 个错误
                  </h3>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {currentResult.errors.map((error: any, index: number) => (
                    <div key={index} className="text-sm text-red-800">
                      {error.row && <span className="font-medium">第{error.row}行</span>}
                      {error.field && <span className="font-medium"> [{error.field}]</span>}
                      {': '}
                      {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 确认按钮 */}
            {hasData && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-800 text-sm">
                    ⚠️ {importType === 'skills' 
                      ? '导入将更新或添加能力定义（相同模块+技能名会更新）'
                      : '导入将覆盖所有现有评估数据'
                    }
                  </p>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={isLoading || !currentResult.success}
                  className={`w-full px-6 py-3 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 ${
                    importType === 'skills' ? 'bg-blue-600' : 'bg-green-600'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>导入中...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>确认导入</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 上传状态消息 */}
        {uploadStatus !== 'idle' && (
          <div className={`rounded-lg p-4 ${
            uploadStatus === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              {uploadStatus === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={uploadStatus === 'success' ? 'text-green-800' : 'text-red-800'}>
                {uploadMessage}
              </span>
            </div>
            
            {uploadStatus === 'success' && (
              <div className="mt-4">
                <a
                  href="/competency-assessment"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>查看能力评估</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
