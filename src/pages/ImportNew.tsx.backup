import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, Database, ListTree } from 'lucide-react';
import { parseComplexExcel, type ParseResult as AssessmentParseResult } from '../lib/complexExcelParser';
import { parseSkillDefinition, type SkillParseResult } from '../lib/skillDefinitionParser';
import { supabaseService } from '../lib/supabaseService';

type ImportType = 'skills' | 'assessments';

export function ImportNew() {
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
          setUploadMessage(`✅ 成功导入 ${result.count} 个能力定义`);
        } else {
          setUploadStatus('error');
          setUploadMessage('❌ 导入失败');
        }
      } else if (importType === 'assessments' && assessmentResult?.data) {
        // 导入能力评估
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

  const currentResult = importType === 'skills' ? skillResult : assessmentResult;
  const hasData = importType === 'skills' ? !!skillResult?.skills.length : !!assessmentResult?.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">数据导入中心</h1>
          <p className="text-gray-600 mt-2">选择导入类型并上传对应的Excel文件</p>
        </div>

        {/* 导入类型选择（大卡片样式） */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 能力定义导入 */}
          <button
            onClick={() => {
              setImportType('skills');
              setFile(null);
              setSkillResult(null);
              setAssessmentResult(null);
              setUploadStatus('idle');
            }}
            className={`relative p-8 rounded-2xl border-2 transition-all duration-300 text-left ${
              importType === 'skills'
                ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg scale-105'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div className={`p-4 rounded-xl ${
                importType === 'skills' ? 'bg-blue-600' : 'bg-blue-100'
              }`}>
                <ListTree className={`w-8 h-8 ${
                  importType === 'skills' ? 'text-white' : 'text-blue-600'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-2 ${
                  importType === 'skills' ? 'text-blue-900' : 'text-gray-800'
                }`}>
                  📋 能力定义导入
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  导入9大能力模块和39个能力类型定义
                </p>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span>格式：编号 | 模块 | 类型 | 工程师</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span>示例：1 | BPS elements | BPS System approach</span>
                  </div>
                </div>
              </div>
            </div>
            {importType === 'skills' && (
              <div className="absolute top-4 right-4">
                <div className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
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
              setUploadStatus('idle');
            }}
            className={`relative p-8 rounded-2xl border-2 transition-all duration-300 text-left ${
              importType === 'assessments'
                ? 'border-green-600 bg-gradient-to-br from-green-50 to-green-100 shadow-lg scale-105'
                : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div className={`p-4 rounded-xl ${
                importType === 'assessments' ? 'bg-green-600' : 'bg-green-100'
              }`}>
                <FileSpreadsheet className={`w-8 h-8 ${
                  importType === 'assessments' ? 'text-white' : 'text-green-600'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-2 ${
                  importType === 'assessments' ? 'text-green-900' : 'text-gray-800'
                }`}>
                  📊 能力评估导入
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  导入员工的能力评估数据（横向矩阵格式）
                </p>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span>格式：Department | Name | C/T得分对...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span>包含：部门、员工、技能评分</span>
                  </div>
                </div>
              </div>
            </div>
            {importType === 'assessments' && (
              <div className="absolute top-4 right-4">
                <div className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  已选择
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Excel格式说明 */}
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
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">第1行：</span>
                        <span>标题行（编号、模块、类型、工程师）</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">第2行起：</span>
                        <span>数据行（每行一个能力类型）</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">列定义：</h4>
                    <ul className="space-y-1.5 text-sm text-blue-800">
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">编号：</span>
                        <span>能力序号（1-39）</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">模块：</span>
                        <span>9大能力模块名称（如：BPS elements, Investment efficiency_PGL）</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">类型：</span>
                        <span>具体能力名称（如：BPS System approach, DFMA）</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">工程师：</span>
                        <span>负责工程师姓名（可选）</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-blue-100 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">9大能力模块：</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                      <div>1. BPS elements</div>
                      <div>2. Investment efficiency_PGL</div>
                      <div>3. Investment efficiency_IE</div>
                      <div>4. Waste-free&stable flow_TPM</div>
                      <div>5. Waste-free&stable flow_LBP</div>
                      <div>6. Everybody's CIP</div>
                      <div>7. Leadership commitment</div>
                      <div>8. CIP in indirect area_LEAN</div>
                      <div>9. Digital Transformation</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">表头结构（横向矩阵）：</h4>
                    <ul className="space-y-1.5 text-sm text-green-800">
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">第1-3行：</span>
                        <span>分类表头（大分类、子分类、能力类型等，可选）</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">第4行：</span>
                        <span>技能名称（每个技能名称占一列，如：BPS System approach）</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">第5行：</span>
                        <span>C/T标记（C = Current当前，T = Target目标）</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">第6行起：</span>
                        <span>数据行（每行一个员工）</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">列定义：</h4>
                    <ul className="space-y-1.5 text-sm text-green-800">
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">第A列：</span>
                        <span>Department（部门）</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">第B列：</span>
                        <span>Name（员工姓名）</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold min-w-[80px]">第C列起：</span>
                        <span>每个技能占两列（C列=当前得分，T列=目标得分）</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-green-100 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-2">⚠️ 注意事项：</h4>
                    <ul className="space-y-1 text-xs text-green-800">
                      <li>• 得分范围：1-5分</li>
                      <li>• 目标得分必须 ≥ 当前得分</li>
                      <li>• 导入将覆盖所有现有评估数据</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 文件上传区域 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 hover:border-blue-400 transition-colors">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className={`p-6 rounded-full ${
                importType === 'skills' ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                <Upload className={`w-12 h-12 ${
                  importType === 'skills' ? 'text-blue-600' : 'text-green-600'
                }`} />
              </div>
              
              <div className="text-center">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className={`text-lg font-semibold hover:opacity-80 ${
                    importType === 'skills' ? 'text-blue-600' : 'text-green-600'
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
                  importType === 'skills' ? 'bg-blue-600' : 'bg-green-600'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>解析中...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>开始解析</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 解析结果 */}
        {currentResult && (
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
                    发现 {currentResult.errors.length} 个错误，需要修正
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
              <div className="space-y-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 mb-1">⚠️ 导入确认</p>
                      <p className="text-amber-800 text-sm">
                        {importType === 'skills' 
                          ? '导入将更新或添加能力定义（相同模块+技能名的记录会被更新）'
                          : '导入将 覆盖所有现有评估数据，此操作不可撤销！'
                        }
                      </p>
                    </div>
                  </div>
                </div>

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
              </div>
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
              <div className="flex gap-3">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = '#/assessment';
                  }}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
                >
                  <span>查看能力评估</span>
                  <span>→</span>
                </a>
                <button
                  onClick={() => {
                    setFile(null);
                    setSkillResult(null);
                    setAssessmentResult(null);
                    setUploadStatus('idle');
                    setUploadMessage('');
                  }}
                  className="px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  继续导入
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
