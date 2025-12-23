import * as XLSX from 'xlsx';

/**
 * 能力定义解析器
 * 解析格式：编号 | 模块 | 类型 | 工程师
 */

export interface SkillDefinition {
  module_id: number;
  module_name: string;
  skill_name: string;
  display_order: number;
}

export interface SkillParseError {
  row?: number;
  field?: string;
  message: string;
}

export interface SkillParseResult {
  success: boolean;
  skills: SkillDefinition[];
  errors: SkillParseError[];
  summary: {
    total: number;
    modules: number;
  };
}

/**
 * 9大能力模块映射
 */
const MODULE_MAPPING: Record<string, number> = {
  'BPS elements': 1,
  'Investment efficiency_PGL': 2,
  'Investment efficiency_IE': 3,
  'Waste-free&stable flow_TPM': 4,
  'Waste-free&stable flow_LBP': 5,
  "Everybody's CIP": 6,
  'Leadership commitment': 7,
  'CIP in indirect area_LEAN': 8,
  'Digital Transformation': 9,
};

/**
 * 获取模块ID（精确匹配或模糊匹配）
 */
function getModuleId(moduleName: string): number {
  // 清理模块名
  const cleanName = moduleName.trim();
  
  // 精确匹配
  if (MODULE_MAPPING[cleanName]) {
    return MODULE_MAPPING[cleanName];
  }
  
  // 模糊匹配
  const lowerName = cleanName.toLowerCase();
  for (const [key, id] of Object.entries(MODULE_MAPPING)) {
    if (key.toLowerCase() === lowerName) {
      return id;
    }
  }
  
  // 部分匹配
  if (lowerName.includes('bps')) return 1;
  if (lowerName.includes('investment') && lowerName.includes('pgl')) return 2;
  if (lowerName.includes('investment') && lowerName.includes('ie')) return 3;
  if (lowerName.includes('waste') && lowerName.includes('tpm')) return 4;
  if (lowerName.includes('waste') && lowerName.includes('lbp')) return 5;
  if (lowerName.includes('cip') && lowerName.includes('everybody')) return 6;
  if (lowerName.includes('leadership')) return 7;
  if (lowerName.includes('lean')) return 8;
  if (lowerName.includes('digital')) return 9;
  
  // 默认返回1
  return 1;
}

/**
 * 解析能力定义Excel
 */
export async function parseSkillDefinition(file: File): Promise<SkillParseResult> {
  const errors: SkillParseError[] = [];
  const skills: SkillDefinition[] = [];
  
  try {
    // 读取Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 转换为JSON
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: null,
    });

    if (rawData.length < 2) {
      errors.push({ message: 'Excel数据不足，至少需要标题行和一行数据' });
      return { 
        success: false, 
        skills: [], 
        errors, 
        summary: { total: 0, modules: 0 } 
      };
    }

    // 查找标题行
    let headerRow = 0;
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const row = rawData[i];
      if (!row) continue;
      
      const rowStr = row.map(c => String(c || '').toLowerCase()).join('|');
      if ((rowStr.includes('编号') || rowStr.includes('number')) &&
          (rowStr.includes('模块') || rowStr.includes('module')) &&
          (rowStr.includes('类型') || rowStr.includes('type'))) {
        headerRow = i;
        break;
      }
    }

    const headers = rawData[headerRow];
    
    // 查找列索引
    let numberCol = -1;
    let moduleCol = -1;
    let typeCol = -1;
    let engineerCol = -1;

    headers.forEach((header: any, index: number) => {
      const h = String(header || '').toLowerCase().trim();
      if (h.includes('编号') || h === 'number' || h === 'no') numberCol = index;
      if (h.includes('模块') || h === 'module') moduleCol = index;
      if (h.includes('类型') || h === 'type' || h.includes('能力')) typeCol = index;
      if (h.includes('工程师') || h === 'engineer' || h.includes('owner')) engineerCol = index;
    });

    if (moduleCol === -1 || typeCol === -1) {
      errors.push({ 
        message: `未找到必需列。找到的列：${headers.join(', ')}。需要：模块、类型` 
      });
      return { 
        success: false, 
        skills: [], 
        errors, 
        summary: { total: 0, modules: 0 } 
      };
    }

    // 解析数据行
    const moduleSet = new Set<string>();
    
    for (let i = headerRow + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const moduleName = String(row[moduleCol] || '').trim();
      const skillName = String(row[typeCol] || '').trim();

      // 跳过空行
      if (!moduleName && !skillName) continue;

      // 验证必填字段
      if (!moduleName) {
        errors.push({
          row: i + 1,
          field: '模块',
          message: '模块名称不能为空',
        });
        continue;
      }

      if (!skillName) {
        errors.push({
          row: i + 1,
          field: '类型',
          message: '能力类型不能为空',
        });
        continue;
      }

      // 获取模块ID
      const moduleId = getModuleId(moduleName);
      moduleSet.add(moduleName);

      // 添加技能
      skills.push({
        module_id: moduleId,
        module_name: moduleName,
        skill_name: skillName,
        display_order: skills.length + 1,
      });
    }

    return {
      success: errors.length === 0,
      skills,
      errors,
      summary: {
        total: skills.length,
        modules: moduleSet.size,
      },
    };
  } catch (error: any) {
    errors.push({
      message: `文件解析失败: ${error.message}`,
    });
    return {
      success: false,
      skills: [],
      errors,
      summary: { total: 0, modules: 0 },
    };
  }
}
