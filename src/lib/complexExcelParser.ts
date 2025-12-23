import * as XLSX from 'xlsx';

/**
 * 复杂Excel解析器
 * 专门处理多层表头的横向能力矩阵格式
 */

export interface ParsedExcelData {
  departments: string[];
  employees: Array<{
    employee_id: string;
    name: string;
    department: string;
  }>;
  skills: Array<{
    module_id: number;
    module_name: string;
    skill_name: string;
    display_order: number;
  }>;
  assessments: Array<{
    employee_id: string;
    skill_name: string;
    module_name: string;
    current_level: number;
    target_level: number;
  }>;
}

export interface ParseError {
  row?: number;
  column?: number;
  field?: string;
  message: string;
  actualValue?: any;
}

export interface ParseResult {
  success: boolean;
  data: ParsedExcelData | null;
  errors: ParseError[];
  summary: {
    departments: number;
    employees: number;
    skills: number;
    assessments: number;
  };
}

/**
 * 模块名称映射到ID
 */
const MODULE_MAP: Record<string, number> = {
  'BPS System approach': 1,
  'Investment efficiency': 1,
  'PGL': 1,
  'IE': 2,
  'TPM': 3,
  'LBP': 4,
  'LEAN': 5,
  'Waste-free': 2,
  'Everybody': 4,
  'Leadership': 6,
  'CIP': 4,
  'Digital': 7,
  'VSM': 2,
  'SMC': 2,
  'Problem solving': 3,
  'Workplace design': 2,
  'MTM': 2,
  'Loss': 3,
  'Logistic': 2,
  'Pull': 2,
  'Package': 2,
  'Material': 2,
  'Ship': 2,
  'Top idea': 4,
  'Give me 5': 4,
  'Speed week': 4,
  'Kaizen': 4,
  'BLI': 4,
  'Kyoben': 4,
  'Jishuken': 4,
  'BMT': 6,
  'BPS Essential': 1,
  'BPS maturity': 1,
  'Customer interview': 1,
  'Employee capacity': 6,
  'Meeting cascade': 6,
  'WILO': 6,
  'Skill Matrix': 6,
  'Lean Leadership': 6,
  'Power BI': 7,
  'Low code': 7,
};

/**
 * 根据技能名称推断模块
 */
function inferModule(skillName: string): { moduleId: number; moduleName: string } {
  const skillLower = skillName.toLowerCase();
  
  // 尝试匹配模块关键字
  for (const [keyword, moduleId] of Object.entries(MODULE_MAP)) {
    if (skillLower.includes(keyword.toLowerCase())) {
      return {
        moduleId,
        moduleName: getModuleName(moduleId),
      };
    }
  }
  
  // 默认返回TPM基础
  return { moduleId: 1, moduleName: 'TPM基础' };
}

/**
 * 获取模块名称
 */
function getModuleName(moduleId: number): string {
  const names: Record<number, string> = {
    1: 'TPM基础',
    2: '精益流程',
    3: '问题解决',
    4: '项目管理',
    5: '数据分析',
    6: '团队领导',
    7: '质量管理',
    8: '设备管理',
    9: '流程优化',
  };
  return names[moduleId] || 'TPM基础';
}

/**
 * 解析复杂Excel文件
 */
export async function parseComplexExcel(file: File): Promise<ParseResult> {
  const errors: ParseError[] = [];
  
  try {
    // 读取Excel文件
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 转换为JSON（保留空单元格）
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: null,
      raw: false,
    });

    if (rawData.length < 7) {
      errors.push({ message: 'Excel数据行数不足，至少需要7行（表头+数据）' });
      return { success: false, data: null, errors, summary: { departments: 0, employees: 0, skills: 0, assessments: 0 } };
    }

    // 分析表头结构
    // 根据实际Excel格式：
    // Row 0-2: 多层分类表头
    // Row 3: 分类标签（Current, Target, LV3, LV4, LV5...）
    // Row 4: 技能名称（在奇数列：2, 4, 6, 8...）
    // Row 5: C/T标记（Department, Name, C, T, C, T...）
    // Row 6+: 数据行

    const skillNameRow = 4;  // 修改：技能名称在第5行（索引4）
    const ctMarkerRow = 5;   // 修改：C/T标记在第6行（索引5）
    const dataStartRow = 6;  // 修改：数据从第7行开始（索引6）

    // 1. 提取部门列和姓名列的位置
    // 尝试在多行中查找Department和Name
    let deptColIndex = -1;
    let nameColIndex = -1;

    console.log('🔍 开始查找Department和Name列...');

    // 优先在ctMarkerRow（第4行，索引4）查找 - 这是最可能的位置
    console.log(`查找第${ctMarkerRow + 1}行（ctMarkerRow）:`, rawData[ctMarkerRow]?.slice(0, 5));
    for (let i = 0; i < (rawData[ctMarkerRow]?.length || 0); i++) {
      const cell = String(rawData[ctMarkerRow]?.[i] || '').toLowerCase().trim();
      if ((cell === 'department' || cell.includes('部门')) && deptColIndex === -1) {
        deptColIndex = i;
        console.log(`✅ 找到Department列：索引${i}, 内容="${rawData[ctMarkerRow][i]}"`);
      }
      if ((cell === 'name' || cell.includes('姓名')) && nameColIndex === -1) {
        nameColIndex = i;
        console.log(`✅ 找到Name列：索引${i}, 内容="${rawData[ctMarkerRow][i]}"`);
      }
      if (deptColIndex >= 0 && nameColIndex >= 0) break;
    }

    // 如果ctMarkerRow没找到，尝试在skillNameRow（第3行）查找
    if (deptColIndex === -1 || nameColIndex === -1) {
      console.log(`查找第${skillNameRow + 1}行（skillNameRow）:`, rawData[skillNameRow]?.slice(0, 5));
      for (let i = 0; i < (rawData[skillNameRow]?.length || 0); i++) {
        const cell = String(rawData[skillNameRow]?.[i] || '').toLowerCase().trim();
        if ((cell === 'department' || cell.includes('部门')) && deptColIndex === -1) {
          deptColIndex = i;
          console.log(`✅ 找到Department列：索引${i}, 内容="${rawData[skillNameRow][i]}"`);
        }
        if ((cell === 'name' || cell.includes('姓名')) && nameColIndex === -1) {
          nameColIndex = i;
          console.log(`✅ 找到Name列：索引${i}, 内容="${rawData[skillNameRow][i]}"`);
        }
        if (deptColIndex >= 0 && nameColIndex >= 0) break;
      }
    }

    // 如果还是没找到，尝试根据数据行推断（前两列通常是Department和Name）
    if (deptColIndex === -1 || nameColIndex === -1) {
      const firstDataRow = rawData[dataStartRow];
      if (firstDataRow && firstDataRow.length >= 2) {
        const col0 = String(firstDataRow[0] || '').trim();
        const col1 = String(firstDataRow[1] || '').trim();
        
        // 如果前两列有数据，假设第0列是部门，第1列是姓名
        if (col0 && col1 && deptColIndex === -1 && nameColIndex === -1) {
          deptColIndex = 0;
          nameColIndex = 1;
          console.log('推断：第0列=部门，第1列=姓名');
        }
      }
    }

    if (deptColIndex === -1 || nameColIndex === -1) {
      // 提供更详细的错误信息
      const row3Content = rawData[skillNameRow]?.slice(0, 5).map((c: any) => String(c || '')).join(' | ');
      const row4Content = rawData[ctMarkerRow]?.slice(0, 5).map((c: any) => String(c || '')).join(' | ');
      errors.push({ 
        message: `未找到"Department"和"Name"列。\n第4行前5列内容: ${row3Content}\n第5行前5列内容: ${row4Content}\n请确保前两列是部门和姓名。` 
      });
      return { success: false, data: null, errors, summary: { departments: 0, employees: 0, skills: 0, assessments: 0 } };
    }

    // 2. 解析技能列（从姓名列后开始）
    const skillStartCol = Math.max(deptColIndex, nameColIndex) + 1;
    const skills: Array<{ colIndex: number; name: string; moduleId: number; moduleName: string }> = [];
    
    console.log(`\n🔍 开始解析技能列，从第${skillStartCol}列开始...`);
    console.log(`第${skillNameRow + 1}行（技能名称行）内容:`, rawData[skillNameRow]?.slice(0, 10));
    console.log(`第${ctMarkerRow + 1}行（C/T标记行）内容:`, rawData[ctMarkerRow]?.slice(0, 10));
    
    let displayOrder = 1;
    for (let colIndex = skillStartCol; colIndex < (rawData[skillNameRow]?.length || 0); colIndex++) {
      const skillName = rawData[skillNameRow]?.[colIndex];
      const ctMarker = String(rawData[ctMarkerRow]?.[colIndex] || '').toUpperCase().trim();
      
      console.log(`  列${colIndex}: 技能名="${skillName}", C/T标记="${ctMarker}"`);
      
      // 跳过空列和非C列
      if (!skillName || !ctMarker) {
        console.log(`    ⏭️ 跳过（空单元格）`);
        continue;
      }
      
      // 只处理C列（Current列），T列紧跟其后
      if (ctMarker === 'C') {
        const skillNameStr = String(skillName).trim();
        if (skillNameStr && !skillNameStr.includes('Gap') && !skillNameStr.includes('Con.') && !skillNameStr.includes('Exe.')) {
          const { moduleId, moduleName } = inferModule(skillNameStr);
          skills.push({
            colIndex,
            name: skillNameStr,
            moduleId,
            moduleName,
          });
          console.log(`    ✅ 找到技能: "${skillNameStr}" (模块: ${moduleName})`);
        } else {
          console.log(`    ⏭️ 跳过（包含Gap/Con./Exe.或为空）`);
        }
      } else {
        console.log(`    ⏭️ 跳过（不是C列，是"${ctMarker}"）`);
      }
    }

    console.log(`\n📊 技能解析完成，共找到 ${skills.length} 个技能\n`);

    if (skills.length === 0) {
      errors.push({ 
        message: `未找到任何技能列。\n请检查：\n1. 第${skillNameRow + 1}行（技能名称）是否有内容\n2. 第${ctMarkerRow + 1}行（C/T标记）是否有"C"标记\n3. 从第${skillStartCol + 1}列开始是否有技能数据` 
      });
      return { success: false, data: null, errors, summary: { departments: 0, employees: 0, skills: 0, assessments: 0 } };
    }

    // 3. 解析数据行
    const departments = new Set<string>();
    const employees: ParsedExcelData['employees'] = [];
    const assessments: ParsedExcelData['assessments'] = [];
    const employeeIdSet = new Set<string>(); // 用于检测重复的employee_id
    const employeeIdCounter = new Map<string, number>(); // 用于为重复的ID添加后缀

    for (let rowIndex = dataStartRow; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;

      const department = String(row[deptColIndex] || '').trim();
      const name = String(row[nameColIndex] || '').trim();

      // 跳过空行和汇总行
      if (!department || !name || 
          name.toLowerCase().includes('nr. of gaps') || 
          name.toLowerCase().includes('competence field') ||
          department.toLowerCase() === 'department') {
        continue;
      }

      // 添加部门
      departments.add(department);

      // 生成employee_id，处理重复情况
      let baseEmployeeId = `${department}_${name}`.replace(/\s+/g, '_');
      let employeeId = baseEmployeeId;
      
      // 如果ID已存在，添加数字后缀
      if (employeeIdSet.has(employeeId)) {
        const count = employeeIdCounter.get(baseEmployeeId) || 1;
        employeeId = `${baseEmployeeId}_${count + 1}`;
        employeeIdCounter.set(baseEmployeeId, count + 1);
        console.warn(`⚠️ 第${rowIndex + 1}行：发现重复员工 "${department} - ${name}"，自动重命名为 "${employeeId}"`);
      } else {
        employeeIdCounter.set(baseEmployeeId, 1);
      }
      
      employeeIdSet.add(employeeId);
      
      employees.push({
        employee_id: employeeId,
        name,
        department,
      });

      // 解析每个技能的得分
      for (const skill of skills) {
        const currentCol = skill.colIndex;
        const targetCol = currentCol + 1;

        const currentValue = row[currentCol];
        const targetValue = row[targetCol];

        // 跳过空值
        if (!currentValue || !targetValue) continue;

        const current = parseFloat(String(currentValue));
        const target = parseFloat(String(targetValue));

        // 验证得分
        if (isNaN(current) || isNaN(target)) continue;
        if (current < 1 || current > 5 || target < 1 || target > 5) {
          errors.push({
            row: rowIndex + 1,
            field: skill.name,
            message: `得分必须在1-5之间`,
            actualValue: `${current}/${target}`,
          });
          continue;
        }
        if (target < current) {
          errors.push({
            row: rowIndex + 1,
            field: skill.name,
            message: `目标得分不能低于现状得分`,
            actualValue: `${current}/${target}`,
          });
          continue;
        }

        assessments.push({
          employee_id: employeeId,
          skill_name: skill.name,
          module_name: skill.moduleName,
          current_level: Math.round(current),
          target_level: Math.round(target),
        });
      }
    }

    // 4. 构建技能列表（去重）
    const skillsData = skills.map((skill, index) => ({
      module_id: skill.moduleId,
      module_name: skill.moduleName,
      skill_name: skill.name,
      display_order: index + 1,
    }));

    // 5. 返回解析结果
    const data: ParsedExcelData = {
      departments: Array.from(departments),
      employees,
      skills: skillsData,
      assessments,
    };

    return {
      success: errors.length === 0,
      data,
      errors,
      summary: {
        departments: data.departments.length,
        employees: data.employees.length,
        skills: data.skills.length,
        assessments: data.assessments.length,
      },
    };
  } catch (error: any) {
    errors.push({
      message: `文件解析失败: ${error.message}`,
    });
    return {
      success: false,
      data: null,
      errors,
      summary: { departments: 0, employees: 0, skills: 0, assessments: 0 },
    };
  }
}
