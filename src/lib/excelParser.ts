import * as XLSX from 'xlsx';
import type { CompetencyDefinitionInsert, CompetencyAssessmentInsert } from './supabaseService';

/**
 * Excel解析错误
 */
export interface ParseError {
  row: number;
  field?: string;
  message: string;
  actualValue?: any;
}

/**
 * 解析结果
 */
export interface ParseResult<T> {
  data: T[];
  errors: ParseError[];
  success: boolean;
}

/**
 * Excel工具类 - 负责解析Excel文件
 */
export class ExcelParser {
  /**
   * 读取Excel文件为JSON
   */
  private static async readExcelFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // 转换为JSON，header: 1表示使用第一行作为标题
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '', // 默认值为空字符串
            blankrows: false // 跳过空行
          });

          resolve(jsonData as any[]);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      reader.readAsBinaryString(file);
    });
  }

  /**
   * 查找标题行索引
   * 标题行应包含特定的关键字
   */
  private static findHeaderRow(data: any[], keywords: string[]): number {
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;

      const rowText = row.join('|').toLowerCase();
      const matchCount = keywords.filter(keyword => 
        rowText.includes(keyword.toLowerCase())
      ).length;

      // 如果匹配到超过一半的关键字，认为是标题行
      if (matchCount >= Math.ceil(keywords.length / 2)) {
        return i;
      }
    }

    return -1; // 未找到标题行
  }

  /**
   * 根据标题行获取列索引映射
   */
  private static getColumnMapping(headerRow: any[], expectedHeaders: Record<string, string[]>): Record<string, number> {
    const mapping: Record<string, number> = {};

    for (const [key, aliases] of Object.entries(expectedHeaders)) {
      const index = headerRow.findIndex((header: any) => {
        if (!header) return false;
        // 清理标题文本：移除换行、空格、特殊字符
        const headerStr = String(header)
          .toLowerCase()
          .replace(/[\r\n\s_\-]/g, '') // 移除换行、空格、下划线、连字符
          .trim();
        
        return aliases.some(alias => {
          const aliasClean = alias.toLowerCase().replace(/[\r\n\s_\-]/g, '');
          return headerStr.includes(aliasClean) || aliasClean.includes(headerStr);
        });
      });

      if (index >= 0) {
        mapping[key] = index;
      }
    }

    return mapping;
  }
  
  /**
   * 获取实际的列标题（用于调试）
   */
  private static getActualHeaders(headerRow: any[]): string[] {
    return headerRow
      .map((h, i) => h ? `[${i}] ${String(h).substring(0, 50)}` : null)
      .filter(Boolean) as string[];
  }

  /**
   * 解析能力定义表
   */
  static async parseCompetencyDefinitions(file: File): Promise<ParseResult<CompetencyDefinitionInsert>> {
    const errors: ParseError[] = [];
    const data: CompetencyDefinitionInsert[] = [];

    try {
      const rawData = await this.readExcelFile(file);

      // 定义标题关键字
      const headerKeywords = ['编号', 'number', '模块', 'module', '类型', 'type', '工程师', 'engineer'];
      
      // 查找标题行
      const headerRowIndex = this.findHeaderRow(rawData, headerKeywords);
      
      if (headerRowIndex === -1) {
        errors.push({
          row: 0,
          message: '未找到标题行。请确保Excel包含：编号、模块、类型、工程师等列标题',
        });
        return { data: [], errors, success: false };
      }

      const headerRow = rawData[headerRowIndex];

      // 获取列映射（添加更多别名）
      const columnMapping = this.getColumnMapping(headerRow, {
        id: ['编号', 'number', 'id', 'no', '序号'],
        moduleName: ['模块', 'module', '能力模块', 'competencymodule', 'skillmodule', '技能模块'],
        competencyType: ['类型', 'type', '能力类型', 'competency', 'competencytype', 'skill', 'skilltype', '技能类型', '能力名称'],
        engineer: ['工程师', 'engineer', '负责人', 'owner', '姓名', 'name'],
      });

      // 检查必需列是否存在
      const requiredCols = ['moduleName', 'competencyType'];
      const missingCols = requiredCols.filter(col => columnMapping[col] === undefined);
      
      if (missingCols.length > 0) {
        // 获取实际的列标题用于调试
        const actualHeaders = this.getActualHeaders(headerRow);
        
        errors.push({
          row: headerRowIndex + 1,
          message: `缺少必需列: ${missingCols.join(', ')}\n\n实际找到的列标题：\n${actualHeaders.join('\n')}\n\n请确保Excel包含以下列：\n- 模块/Module\n- 类型/Type`,
        });
        return { data: [], errors, success: false };
      }

      // 解析数据行（从标题行后一行开始）
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!Array.isArray(row) || row.length === 0) continue;

        const moduleName = row[columnMapping.moduleName]?.toString().trim();
        const competencyType = row[columnMapping.competencyType]?.toString().trim();

        // 跳过空行
        if (!moduleName && !competencyType) continue;

        // 验证必填字段
        if (!moduleName) {
          errors.push({
            row: i + 1,
            field: 'moduleName',
            message: '缺少能力模块名称',
            actualValue: moduleName,
          });
          continue;
        }

        if (!competencyType) {
          errors.push({
            row: i + 1,
            field: 'competencyType',
            message: '缺少能力类型名称',
            actualValue: competencyType,
          });
          continue;
        }

        // 构造数据对象
        const id = columnMapping.id !== undefined ? row[columnMapping.id] : null;
        const moduleId = this.getModuleId(moduleName);
        const engineer = columnMapping.engineer !== undefined ? 
          row[columnMapping.engineer]?.toString().trim() : null;

        data.push({
          module_id: moduleId,
          module_name: moduleName,
          competency_type: competencyType,
          competency_code: id ? `${moduleName}-${id}` : null,
          owner_engineer: engineer || null,
          is_key_competency: false,
        });
      }

      return {
        data,
        errors,
        success: errors.length === 0 && data.length > 0,
      };
    } catch (error) {
      errors.push({
        row: 0,
        message: `文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
      return { data: [], errors, success: false };
    }
  }

  /**
   * 解析能力评估表（支持纵向和横向两种格式）
   */
  static async parseCompetencyAssessments(file: File): Promise<ParseResult<CompetencyAssessmentInsert>> {
    const errors: ParseError[] = [];
    const data: CompetencyAssessmentInsert[] = [];

    try {
      const rawData = await this.readExcelFile(file);
      
      // 尝试检测Excel格式
      const format = this.detectExcelFormat(rawData);
      
      if (format === 'horizontal') {
        // 横向格式：第一行是能力类型，每行是一个人
        return this.parseHorizontalFormat(rawData);
      } else {
        // 纵向格式：传统格式，每行是一个能力评估
        return this.parseVerticalFormat(rawData);
      }
    } catch (error) {
      errors.push({
        row: 0,
        message: `文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
      return { data: [], errors, success: false };
    }
  }

  /**
   * 检测Excel格式（横向 vs 纵向）
   */
  private static detectExcelFormat(rawData: any[][]): 'horizontal' | 'vertical' {
    if (!rawData || rawData.length < 2) return 'vertical';
    
    const firstRow = rawData[0];
    if (!Array.isArray(firstRow) || firstRow.length < 3) return 'vertical';
    
    // 检查第一行前3列：如果包含"部门"、"姓名"等关键字，可能是横向格式
    const firstThreeCols = firstRow.slice(0, 3).map(c => String(c || '').toLowerCase());
    const hasPersonInfo = firstThreeCols.some(col => 
      ['部门', 'dept', '姓名', 'name'].some(kw => col.includes(kw))
    );
    
    // 检查第一行是否包含"模块"、"类型"列名（纵向格式特征）
    const hasModuleTypeHeaders = firstRow.some((col: any) => {
      const colStr = String(col || '').toLowerCase().replace(/[\s_\-]/g, '');
      return ['模块', 'module', '类型', 'type'].some(kw => colStr.includes(kw));
    });
    
    // 如果有个人信息列但没有"模块/类型"列，判断为横向格式
    if (hasPersonInfo && !hasModuleTypeHeaders) {
      return 'horizontal';
    }
    
    return 'vertical';
  }

  /**
   * 解析横向格式
   * 格式示例：
   * 部门 | 姓名 | 需求分析 | 系统设计-C | 系统设计-T | 编程 | ...
   * SCh  | 张三 | 3/4     | 4         | 5         | 3/4  | ...
   */
  private static parseHorizontalFormat(rawData: any[][]): ParseResult<CompetencyAssessmentInsert> {
    const errors: ParseError[] = [];
    const data: CompetencyAssessmentInsert[] = [];
    
    if (rawData.length < 2) {
      errors.push({ row: 0, message: '数据不足：至少需要标题行和一行数据' });
      return { data: [], errors, success: false };
    }
    
    const headerRow = rawData[0];
    
    // 找到部门、姓名列
    const deptColIndex = headerRow.findIndex((h: any) => {
      const hStr = String(h || '').toLowerCase().replace(/[\s_\-]/g, '');
      return ['部门', 'dept', 'department'].some(kw => hStr.includes(kw));
    });
    
    const nameColIndex = headerRow.findIndex((h: any) => {
      const hStr = String(h || '').toLowerCase().replace(/[\s_\-]/g, '');
      return ['姓名', 'name', '工程师', 'engineer'].some(kw => hStr.includes(kw));
    });
    
    if (deptColIndex === -1 || nameColIndex === -1) {
      const actualHeaders = this.getActualHeaders(headerRow);
      errors.push({
        row: 1,
        message: `横向格式：未找到"部门"和"姓名"列\n\n实际列标题：\n${actualHeaders.join('\n')}\n\n请确保前几列包含：部门、姓名`,
      });
      return { data: [], errors, success: false };
    }
    
    // 能力类型列从姓名列后开始
    const competencyStartCol = Math.max(deptColIndex, nameColIndex) + 1;
    
    // 解析能力类型列（检测是否有-C/-T后缀或C/T格式）
    const competencyColumns: Array<{
      index: number;
      name: string;
      type: 'both' | 'current' | 'target'; // both表示"3/4"格式，current/target表示单独的列
      pairIndex?: number; // 如果是current/target，记录配对列的索引
    }> = [];
    
    for (let i = competencyStartCol; i < headerRow.length; i++) {
      const header = String(headerRow[i] || '').trim();
      if (!header) continue;
      
      const headerClean = header.replace(/[\s_\-]/g, '').toLowerCase();
      
      // 检查是否是-C或-T列
      if (headerClean.endsWith('c') || headerClean.includes('current') || headerClean.includes('现状')) {
        const baseName = header.replace(/[-_\s]*(C|c|Current|current|现状)$/i, '').trim();
        competencyColumns.push({
          index: i,
          name: baseName,
          type: 'current',
        });
      } else if (headerClean.endsWith('t') || headerClean.includes('target') || headerClean.includes('目标')) {
        const baseName = header.replace(/[-_\s]*(T|t|Target|target|目标)$/i, '').trim();
        competencyColumns.push({
          index: i,
          name: baseName,
          type: 'target',
        });
      } else {
        // 默认为"3/4"格式的列
        competencyColumns.push({
          index: i,
          name: header,
          type: 'both',
        });
      }
    }
    
    if (competencyColumns.length === 0) {
      errors.push({
        row: 1,
        message: `横向格式：未找到能力类型列\n\n请确保第${competencyStartCol + 1}列之后是能力类型名称`,
      });
      return { data: [], errors, success: false };
    }
    
    // 配对current/target列
    const pairedColumns: Array<{
      name: string;
      currentIndex: number;
      targetIndex: number;
    }> = [];
    
    const unpairedColumns: typeof competencyColumns = [];
    
    for (const col of competencyColumns) {
      if (col.type === 'both') {
        unpairedColumns.push(col);
      } else if (col.type === 'current') {
        const targetCol = competencyColumns.find(
          c => c.type === 'target' && c.name === col.name && c.index > col.index
        );
        if (targetCol) {
          pairedColumns.push({
            name: col.name,
            currentIndex: col.index,
            targetIndex: targetCol.index,
          });
        } else {
          unpairedColumns.push(col);
        }
      }
    }
    
    // 解析数据行
    for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!Array.isArray(row) || row.length === 0) continue;
      
      const department = String(row[deptColIndex] || '').trim();
      const name = String(row[nameColIndex] || '').trim();
      
      if (!department && !name) continue; // 跳过空行
      
      if (!department) {
        errors.push({
          row: rowIndex + 1,
          field: 'department',
          message: '缺少部门信息',
          actualValue: department,
        });
        continue;
      }
      
      if (!name) {
        errors.push({
          row: rowIndex + 1,
          field: 'name',
          message: '缺少姓名',
          actualValue: name,
        });
        continue;
      }
      
      // 解析每个能力类型
      // 1. 处理配对的C/T列
      for (const paired of pairedColumns) {
        const currentScoreRaw = row[paired.currentIndex];
        const targetScoreRaw = row[paired.targetIndex];
        
        if (!currentScoreRaw && !targetScoreRaw) continue; // 跳过空能力
        
        const currentScore = this.parseScore(currentScoreRaw);
        const targetScore = this.parseScore(targetScoreRaw);
        
        const validationError = this.validateScores(
          currentScore,
          targetScore,
          rowIndex + 1,
          paired.name
        );
        
        if (validationError) {
          errors.push(validationError);
          continue;
        }
        
        // 提取模块名和能力类型
        const { moduleName, competencyType } = this.parseCompetencyName(paired.name);
        
        data.push({
          department,
          engineer_name: name,
          engineer_id: name.replace(/\s+/g, '_'),
          module_id: this.getModuleId(moduleName),
          module_name: moduleName,
          competency_type: competencyType,
          current_score: currentScore!,
          target_score: targetScore!,
          gap: targetScore! - currentScore!,
          assessment_year: new Date().getFullYear(),
        });
      }
      
      // 2. 处理"3/4"格式的列
      for (const col of unpairedColumns) {
        const cellValue = row[col.index];
        if (!cellValue) continue;
        
        const cellStr = String(cellValue).trim();
        
        // 尝试解析"3/4"格式
        const slashMatch = cellStr.match(/^(\d+)\s*[\/\\]\s*(\d+)$/);
        
        if (slashMatch) {
          const currentScore = parseInt(slashMatch[1]);
          const targetScore = parseInt(slashMatch[2]);
          
          const validationError = this.validateScores(
            currentScore,
            targetScore,
            rowIndex + 1,
            col.name
          );
          
          if (validationError) {
            errors.push(validationError);
            continue;
          }
          
          const { moduleName, competencyType } = this.parseCompetencyName(col.name);
          
          data.push({
            department,
            engineer_name: name,
            engineer_id: name.replace(/\s+/g, '_'),
            module_id: this.getModuleId(moduleName),
            module_name: moduleName,
            competency_type: competencyType,
            current_score: currentScore,
            target_score: targetScore,
            gap: targetScore - currentScore,
            assessment_year: new Date().getFullYear(),
          });
        } else if (col.type === 'current' || col.type === 'target') {
          // 单独的C或T列（没有配对）
          const score = this.parseScore(cellValue);
          if (score === null) continue;
          
          const { moduleName, competencyType } = this.parseCompetencyName(col.name);
          
          // 对于单独的列，current和target设为相同值（或跳过）
          errors.push({
            row: rowIndex + 1,
            field: col.name,
            message: `能力"${col.name}"只有${col.type === 'current' ? '现状' : '目标'}得分，缺少${col.type === 'current' ? '目标' : '现状'}得分`,
          });
        } else {
          // 单个数字
          const score = this.parseScore(cellValue);
          if (score !== null) {
            errors.push({
              row: rowIndex + 1,
              field: col.name,
              message: `能力"${col.name}"只有一个得分"${score}"，请使用"现状/目标"格式（如"3/4"）或分为两列（${col.name}-C 和 ${col.name}-T）`,
              actualValue: cellStr,
            });
          }
        }
      }
    }
    
    return {
      data,
      errors,
      success: errors.length === 0 && data.length > 0,
    };
  }

  /**
   * 解析纵向格式（原有逻辑）
   */
  private static parseVerticalFormat(rawData: any[][]): ParseResult<CompetencyAssessmentInsert> {
    const errors: ParseError[] = [];
    const data: CompetencyAssessmentInsert[] = [];

    try {
      // 定义标题关键字
      const headerKeywords = ['部门', 'department', '姓名', 'name', '模块', 'module', 'current', 'target', 'c', 't'];
      
      // 查找标题行
      const headerRowIndex = this.findHeaderRow(rawData, headerKeywords);
      
      if (headerRowIndex === -1) {
        errors.push({
          row: 0,
          message: '未找到标题行。请确保Excel包含：部门、姓名、模块、类型、C（现状）、T（目标）等列标题',
        });
        return { data: [], errors, success: false };
      }

      const headerRow = rawData[headerRowIndex];

      // 获取列映射（添加更多别名）
      const columnMapping = this.getColumnMapping(headerRow, {
        department: ['部门', 'department', 'dept', 'deptname', '所属部门'],
        name: ['姓名', 'name', '工程师', 'engineer', '员工', 'employee'],
        moduleName: ['模块', 'module', '能力模块', 'competencymodule', 'skillmodule', '技能模块'],
        competencyType: ['类型', 'type', '能力类型', 'competency', 'competencytype', 'skill', 'skilltype', '技能类型', '能力名称'],
        currentScore: ['current', '现状', 'c', '现状得分', 'currentscore', 'score', '得分'],
        targetScore: ['target', '目标', 't', '目标得分', 'targetscore', 'goal'],
        year: ['年度', 'year', '评估年度', 'assessmentyear'],
      });

      // 检查必需列
      const requiredCols = ['name', 'moduleName', 'competencyType', 'currentScore', 'targetScore'];
      const missingCols = requiredCols.filter(col => columnMapping[col] === undefined);
      
      if (missingCols.length > 0) {
        // 获取实际的列标题用于调试
        const actualHeaders = this.getActualHeaders(headerRow);
        
        errors.push({
          row: headerRowIndex + 1,
          message: `缺少必需列: ${missingCols.join(', ')}\n\n实际找到的列标题：\n${actualHeaders.join('\n')}\n\n请确保Excel包含以下列（支持中英文）：\n- 姓名/Name\n- 模块/Module\n- 类型/Type\n- 现状得分/Current/C\n- 目标得分/Target/T`,
        });
        return { data: [], errors, success: false };
      }

      // 解析数据行
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!Array.isArray(row) || row.length === 0) continue;

        const name = row[columnMapping.name]?.toString().trim();
        const moduleName = row[columnMapping.moduleName]?.toString().trim();
        const competencyType = row[columnMapping.competencyType]?.toString().trim();

        // 跳过空行
        if (!name && !moduleName && !competencyType) continue;

        // 提取部门（可能与姓名在同一单元格）
        let department = columnMapping.department !== undefined ? 
          row[columnMapping.department]?.toString().trim() : null;
        
        let engineerName = name;
        let engineerId = name;

        // 如果部门为空，尝试从姓名中提取（格式：SCh-PS Gu Xuan）
        if (!department && name) {
          const parts = name.split(/\s+/);
          if (parts.length >= 2) {
            department = parts[0];
            engineerName = parts.slice(1).join(' ');
            engineerId = engineerName.replace(/\s+/g, '_');
          }
        }

        // 验证必填字段
        if (!department) {
          errors.push({
            row: i + 1,
            field: 'department',
            message: '缺少部门信息',
            actualValue: department,
          });
          continue;
        }

        if (!engineerName) {
          errors.push({
            row: i + 1,
            field: 'name',
            message: '缺少姓名',
            actualValue: name,
          });
          continue;
        }

        if (!moduleName) {
          errors.push({
            row: i + 1,
            field: 'moduleName',
            message: '缺少能力模块',
            actualValue: moduleName,
          });
          continue;
        }

        if (!competencyType) {
          errors.push({
            row: i + 1,
            field: 'competencyType',
            message: '缺少能力类型',
            actualValue: competencyType,
          });
          continue;
        }

        // 解析分数
        const currentScoreRaw = row[columnMapping.currentScore];
        const targetScoreRaw = row[columnMapping.targetScore];

        const currentScore = parseInt(String(currentScoreRaw));
        const targetScore = parseInt(String(targetScoreRaw));

        // 验证分数
        if (isNaN(currentScore) || currentScore < 1 || currentScore > 5) {
          errors.push({
            row: i + 1,
            field: 'currentScore',
            message: '现状得分必须在1-5之间',
            actualValue: currentScoreRaw,
          });
          continue;
        }

        if (isNaN(targetScore) || targetScore < 1 || targetScore > 5) {
          errors.push({
            row: i + 1,
            field: 'targetScore',
            message: '目标得分必须在1-5之间',
            actualValue: targetScoreRaw,
          });
          continue;
        }

        if (targetScore < currentScore) {
          errors.push({
            row: i + 1,
            field: 'targetScore',
            message: '目标得分不能低于现状得分',
            actualValue: `Current: ${currentScore}, Target: ${targetScore}`,
          });
          continue;
        }

        // 获取年度
        const year = columnMapping.year !== undefined ? 
          parseInt(String(row[columnMapping.year])) : new Date().getFullYear();

        // 构造数据对象
        data.push({
          engineer_id: engineerId,
          engineer_name: engineerName,
          department: department,
          module_name: moduleName,
          competency_type: competencyType,
          current_score: currentScore,
          target_score: targetScore,
          assessment_year: isNaN(year) ? new Date().getFullYear() : year,
        });
      }

      return {
        data,
        errors,
        success: errors.length === 0 && data.length > 0,
      };
    } catch (error) {
      errors.push({
        row: 0,
        message: `文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
      return { data: [], errors, success: false };
    }
  }

  /**
   * 解析得分（支持多种格式）
   */
  private static parseScore(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    
    const str = String(value).trim();
    const num = parseInt(str);
    
    if (isNaN(num)) return null;
    return num;
  }

  /**
   * 验证得分
   */
  private static validateScores(
    currentScore: number | null,
    targetScore: number | null,
    row: number,
    competencyName: string
  ): ParseError | null {
    if (currentScore === null || isNaN(currentScore) || currentScore < 1 || currentScore > 5) {
      return {
        row,
        field: competencyName,
        message: `现状得分必须在1-5之间`,
        actualValue: String(currentScore),
      };
    }

    if (targetScore === null || isNaN(targetScore) || targetScore < 1 || targetScore > 5) {
      return {
        row,
        field: competencyName,
        message: `目标得分必须在1-5之间`,
        actualValue: String(targetScore),
      };
    }

    if (targetScore < currentScore) {
      return {
        row,
        field: competencyName,
        message: `目标得分(${targetScore})不能低于现状得分(${currentScore})`,
        actualValue: `${currentScore}/${targetScore}`,
      };
    }

    return null;
  }

  /**
   * 从能力名称中提取模块名和能力类型
   * 示例：
   * "TPM基础-设备管理" → {moduleName: "TPM基础", competencyType: "设备管理"}
   * "设备管理" → {moduleName: "TPM基础", competencyType: "设备管理"}
   */
  private static parseCompetencyName(name: string): { moduleName: string; competencyType: string } {
    // 尝试用分隔符拆分
    const separators = ['-', '_', '/', '\\', '|', '－', '—'];
    
    for (const sep of separators) {
      if (name.includes(sep)) {
        const parts = name.split(sep).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          return {
            moduleName: parts[0],
            competencyType: parts.slice(1).join('-'),
          };
        }
      }
    }
    
    // 没有分隔符，尝试智能识别模块
    const moduleKeywords = [
      'TPM基础', 'TPM', '精益流程', 'Lean', '问题解决', 'Problem Solving',
      '项目管理', 'Project Management', '数据分析', 'Data Analysis',
      '团队领导', 'Leadership', '质量管理', 'Quality',
      '设备管理', 'Equipment', '流程优化', 'Process'
    ];
    
    for (const module of moduleKeywords) {
      if (name.startsWith(module)) {
        const competencyType = name.substring(module.length).trim();
        return {
          moduleName: module,
          competencyType: competencyType || name,
        };
      }
    }
    
    // 默认：整个名称作为能力类型，模块根据关键字推断
    let moduleName = 'TPM基础'; // 默认模块
    
    const nameLower = name.toLowerCase();
    if (nameLower.includes('lean') || name.includes('精益') || name.includes('流程')) {
      moduleName = '精益流程';
    } else if (nameLower.includes('problem') || name.includes('问题') || name.includes('解决')) {
      moduleName = '问题解决';
    } else if (nameLower.includes('project') || name.includes('项目') || name.includes('管理')) {
      moduleName = '项目管理';
    } else if (nameLower.includes('data') || name.includes('数据') || name.includes('分析')) {
      moduleName = '数据分析';
    } else if (nameLower.includes('leader') || name.includes('领导') || name.includes('团队')) {
      moduleName = '团队领导';
    } else if (nameLower.includes('quality') || name.includes('质量')) {
      moduleName = '质量管理';
    } else if (nameLower.includes('equipment') || name.includes('设备')) {
      moduleName = '设备管理';
    } else if (name.includes('优化')) {
      moduleName = '流程优化';
    }
    
    return {
      moduleName,
      competencyType: name,
    };
  }

  /**
   * 根据模块名称获取模块ID
   */
  private static getModuleId(moduleName: string): number {
    const moduleMap: Record<string, number> = {
      'TPM基础': 1,
      'TPM': 1,
      '精益流程': 2,
      'Lean': 2,
      '问题解决': 3,
      'Problem Solving': 3,
      '项目管理': 4,
      'Project Management': 4,
      '数据分析': 5,
      'Data Analysis': 5,
      '团队领导': 6,
      'Leadership': 6,
      '质量管理': 7,
      'Quality': 7,
      '设备管理': 8,
      'Equipment': 8,
      '流程优化': 9,
      'Process': 9,
    };

    // 尝试完全匹配
    if (moduleMap[moduleName]) {
      return moduleMap[moduleName];
    }

    // 尝试部分匹配
    for (const [key, id] of Object.entries(moduleMap)) {
      if (moduleName.includes(key) || key.includes(moduleName)) {
        return id;
      }
    }

    // 默认返回1
    return 1;
  }
}
