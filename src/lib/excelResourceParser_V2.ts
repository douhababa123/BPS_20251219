/**
 * Excel资源规划解析工具 V2
 * 
 * 支持复杂的Excel结构：
 * - 第1行：年月（Jan' 2025, February 2025...）
 * - 第2行：CW周数（合并单元格）
 * - 第3行：Day（每天一列）
 * - A列：工程师姓名（每3行合并）
 * - B列：TOPIC/TYPE/LOCATION（每3行循环）
 * - C列开始：每天的任务数据
 * 
 * 按天存储，支持追加模式和版本追踪
 */

import * as XLSX from 'xlsx';
import type { ExcelParseResult } from './database.types';

interface DayColumn {
  columnIndex: number;
  date: string;        // YYYY-MM-DD
  yearMonth: string;   // YYYY-MM
  cwWeek: string;      // CW01
  dayOfMonth: number;  // 1-31
}

interface EmployeeGroup {
  name: string;
  rowIndices: {
    topic: number;
    type: number;
    location: number;
  };
}

interface DailyTask {
  employeeName: string;
  taskDate: string;
  yearMonth: string;
  cwWeek: string;
  dayOfMonth: number;
  topic: string;
  taskType: string;
  location: string;
}

/**
 * 解析复杂Excel文件（V2版本）
 */
export async function parseResourcePlanningExcelV2(
  file: File,
  defaultYear: number = new Date().getFullYear()
): Promise<ExcelParseResult & { dailyTasks?: DailyTask[] }> {
  const batchId = crypto.randomUUID();
  const errors: string[] = [];
  const warnings: string[] = [];
  const dailyTasks: DailyTask[] = [];

  try {
    console.log('📂 开始解析Excel文件:', file.name);

    // 1. 读取Excel文件
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: false,  // 不自动转换日期
      cellStyles: true 
    });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 2. 转换为JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false  // 获取格式化后的字符串
    }) as any[][];

    console.log('📊 Excel总行数:', jsonData.length);
    console.log('📋 前3行数据:');
    console.log('  第1行（年月）:', jsonData[0]);
    console.log('  第2行（CW周）:', jsonData[1]);
    console.log('  第3行（Day）:', jsonData[2]);

    if (jsonData.length < 4) {
      errors.push('Excel格式错误：至少需要4行（3行表头 + 1行数据）');
      return {
        success: false,
        errors,
        fileName: file.name,
        batchId,
        totalRows: 0,
        parsedRows: 0,
      };
    }

    // 3. 解析表头（前3行）
    const yearMonthRow = jsonData[0];
    const cwWeekRow = jsonData[1];
    const dayRow = jsonData[2];

    const dayColumns = parseDayColumns(yearMonthRow, cwWeekRow, dayRow, defaultYear);

    console.log('📅 解析到', dayColumns.length, '个日期列');
    if (dayColumns.length > 0) {
      console.log('  第1列:', dayColumns[0]);
      console.log('  最后1列:', dayColumns[dayColumns.length - 1]);
    }

    if (dayColumns.length === 0) {
      errors.push('未找到有效的日期列，请检查Excel格式');
      return {
        success: false,
        errors,
        fileName: file.name,
        batchId,
        totalRows: jsonData.length - 3,
        parsedRows: 0,
      };
    }

    // 4. 解析员工分组（从第4行开始，每3行一组）
    const employeeGroups = parseEmployeeGroups(jsonData);

    console.log('👥 解析到', employeeGroups.length, '个工程师');

    if (employeeGroups.length === 0) {
      errors.push('未找到有效的员工数据');
      return {
        success: false,
        errors,
        fileName: file.name,
        batchId,
        totalRows: jsonData.length - 3,
        parsedRows: 0,
      };
    }

    // 5. 解析每个工程师的每日任务
    for (const empGroup of employeeGroups) {
      const topicRow = jsonData[empGroup.rowIndices.topic];
      const typeRow = jsonData[empGroup.rowIndices.type];
      const locationRow = jsonData[empGroup.rowIndices.location];

      for (const dayCol of dayColumns) {
        const topic = String(topicRow[dayCol.columnIndex] || '').trim();
        const taskType = String(typeRow[dayCol.columnIndex] || '').trim();
        const location = String(locationRow[dayCol.columnIndex] || '').trim();

        // 如果至少有TYPE有值，就创建任务记录
        if (taskType) {
          dailyTasks.push({
            employeeName: empGroup.name,
            taskDate: dayCol.date,
            yearMonth: dayCol.yearMonth,
            cwWeek: dayCol.cwWeek,
            dayOfMonth: dayCol.dayOfMonth,
            topic: topic || '',
            taskType: taskType,
            location: location || '',
          });
        }
      }
    }

    console.log('✅ 解析完成，总任务数:', dailyTasks.length);

    // 6. 统计
    const uniqueEmployees = new Set(dailyTasks.map(t => t.employeeName)).size;
    const taskTypeCounts = new Map<string, number>();
    dailyTasks.forEach(task => {
      taskTypeCounts.set(task.taskType, (taskTypeCounts.get(task.taskType) || 0) + 1);
    });

    console.log('📊 统计:', {
      工程师数: uniqueEmployees,
      任务总数: dailyTasks.length,
      任务类型分布: Object.fromEntries(taskTypeCounts),
    });

    return {
      success: true,
      dailyTasks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      fileName: file.name,
      batchId,
      totalRows: jsonData.length - 3,
      parsedRows: dailyTasks.length,
    };

  } catch (error: any) {
    console.error('❌ 解析失败:', error);
    errors.push(`文件解析失败: ${error.message}`);
    return {
      success: false,
      errors,
      fileName: file.name,
      batchId,
      totalRows: 0,
      parsedRows: 0,
    };
  }
}

/**
 * 解析日期列（从第3行的Day + 第2行的CW + 第1行的年月）
 */
function parseDayColumns(
  yearMonthRow: any[],
  cwWeekRow: any[],
  dayRow: any[],
  defaultYear: number
): DayColumn[] {
  const dayColumns: DayColumn[] = [];
  let currentYearMonth = '';
  let currentCwWeek = '';

  console.log('🔍 开始解析日期列...');

  for (let colIndex = 2; colIndex < dayRow.length; colIndex++) {
    // 1. 解析Day（第3行）
    const dayValue = String(dayRow[colIndex] || '').trim();
    const dayNum = parseInt(dayValue);

    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      continue;  // 跳过非日期列
    }

    // 2. 解析年月（第1行）- 考虑合并单元格
    const yearMonthValue = String(yearMonthRow[colIndex] || '').trim();
    if (yearMonthValue) {
      currentYearMonth = parseYearMonth(yearMonthValue, defaultYear);
    }

    // 3. 解析CW周（第2行）- 考虑合并单元格
    const cwValue = String(cwWeekRow[colIndex] || '').trim();
    if (cwValue) {
      currentCwWeek = parseCwWeek(cwValue);
    }

    // 4. 组合成日期
    if (currentYearMonth) {
      const [year, month] = currentYearMonth.split('-').map(Number);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      dayColumns.push({
        columnIndex: colIndex,
        date: dateStr,
        yearMonth: currentYearMonth,
        cwWeek: currentCwWeek || 'CW00',
        dayOfMonth: dayNum,
      });
    }
  }

  return dayColumns;
}

/**
 * 解析年月字符串
 * 支持格式：Jan' 2025, January 2025, 2025-01
 */
function parseYearMonth(value: string, defaultYear: number): string {
  // 移除撇号和多余空格
  const cleaned = value.replace(/['']/g, '').trim();

  // 月份映射
  const monthMap: Record<string, number> = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'september': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12,
  };

  // 尝试匹配 "Jan 2025" 或 "January 2025"
  const match = cleaned.match(/([a-z]+)\s*(\d{4})/i);
  if (match) {
    const monthStr = match[1].toLowerCase();
    const year = parseInt(match[2]);
    const month = monthMap[monthStr];
    if (month) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  // 如果只有月份，使用默认年份
  const monthStr = cleaned.toLowerCase();
  if (monthMap[monthStr]) {
    return `${defaultYear}-${String(monthMap[monthStr]).padStart(2, '0')}`;
  }

  // 如果已经是 YYYY-MM 格式
  if (/^\d{4}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  return `${defaultYear}-01`;  // 兜底值
}

/**
 * 解析CW周数
 * 支持格式：CW1, CW01, CW 1, cw1
 */
function parseCwWeek(value: string): string {
  const weekRegex = /CW\s*(\d{1,2})/i;
  const match = value.match(weekRegex);
  if (match) {
    return `CW${match[1].padStart(2, '0')}`;
  }
  return '';
}

/**
 * 解析员工分组（每3行一组：TOPIC/TYPE/LOCATION）
 */
function parseEmployeeGroups(jsonData: any[]): EmployeeGroup[] {
  const groups: EmployeeGroup[] = [];

  console.log('👥 开始解析员工分组...');

  // 从第4行开始（跳过前3行表头）
  for (let rowIndex = 3; rowIndex < jsonData.length; rowIndex += 3) {
    const row1 = jsonData[rowIndex];
    const row2 = jsonData[rowIndex + 1];
    const row3 = jsonData[rowIndex + 2];

    if (!row1 || !row2 || !row3) break;

    // A列：员工姓名（可能在3行中的任何一行）
    let employeeName = String(row1[0] || row2[0] || row3[0] || '').trim();
    
    // 清理员工姓名（移除特殊字符和备注）
    employeeName = cleanEmployeeName(employeeName);

    // B列：应该是 TOPIC, TYPE, LOCATION
    const label1 = String(row1[1] || '').trim().toUpperCase();
    const label2 = String(row2[1] || '').trim().toUpperCase();
    const label3 = String(row3[1] || '').trim().toUpperCase();

    // 跳过表头行（Name, TOPIC等）
    if (!employeeName || employeeName.toLowerCase() === 'name') {
      continue;
    }

    // 判断TOPIC/TYPE/LOCATION的顺序
    let topicRow = rowIndex;
    let typeRow = rowIndex + 1;
    let locationRow = rowIndex + 2;

    // 尝试识别B列的标签
    if (label1.includes('TOPIC')) topicRow = rowIndex;
    else if (label2.includes('TOPIC')) topicRow = rowIndex + 1;
    else if (label3.includes('TOPIC')) topicRow = rowIndex + 2;

    if (label1.includes('TYPE')) typeRow = rowIndex;
    else if (label2.includes('TYPE')) typeRow = rowIndex + 1;
    else if (label3.includes('TYPE')) typeRow = rowIndex + 2;

    if (label1.includes('LOCATION')) locationRow = rowIndex;
    else if (label2.includes('LOCATION')) locationRow = rowIndex + 1;
    else if (label3.includes('LOCATION')) locationRow = rowIndex + 2;

    groups.push({
      name: employeeName,
      rowIndices: {
        topic: topicRow,
        type: typeRow,
        location: locationRow,
      },
    });

    console.log(`  ✅ 工程师: ${employeeName} (行${rowIndex + 1}-${rowIndex + 3})`);
  }

  console.log('📊 共找到', groups.length, '个工程师');

  return groups;
}

/**
 * 清理员工姓名（移除特殊字符和备注）
 */
function cleanEmployeeName(name: string): string {
  return name
    .replace(/\n/g, ' ')           // 移除换行符
    .replace(/\r/g, '')            // 移除回车符
    .replace(/\(.*?\)/g, '')       // 移除括号内容 "(WAS training)"
    .replace(/（.*?）/g, '')       // 移除中文括号内容
    .replace(/\s+/g, ' ')          // 多个空格合并为1个
    .trim();
}

/**
 * 转换为数据库格式
 */
export async function convertToDailyDbFormat(
  parseResult: ExcelParseResult & { dailyTasks?: DailyTask[] },
  employees: Array<{ id: string; name: string; employee_id: string }>
): Promise<{
  success: boolean;
  tasks: Array<{
    employee_id: string;
    task_date: string;
    year_month: string;
    cw_week: string;
    day_of_month: number;
    topic: string;
    task_type: string;
    location: string;
    import_batch_id: string;
    source_file_name: string;
  }>;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tasks: any[] = [];

  if (!parseResult.success || !parseResult.dailyTasks) {
    return {
      success: false,
      tasks: [],
      errors: ['解析失败，无数据'],
      warnings: [],
    };
  }

  // 创建员工名称索引（忽略大小写）
  const employeeMap = new Map<string, { id: string; name: string }>();
  employees.forEach(emp => {
    const key = emp.name.toLowerCase().trim();
    employeeMap.set(key, { id: emp.id, name: emp.name });
    // 同时索引工号
    if (emp.employee_id) {
      employeeMap.set(emp.employee_id.toLowerCase().trim(), { id: emp.id, name: emp.name });
    }
  });

  console.log('🔍 开始匹配员工，数据库中有', employees.length, '个员工');

  // 转换每个任务
  for (const taskData of parseResult.dailyTasks) {
    const employee = employeeMap.get(taskData.employeeName.toLowerCase().trim());
    
    if (!employee) {
      warnings.push(`未找到员工 "${taskData.employeeName}"`);
      continue;
    }

    tasks.push({
      employee_id: employee.id,
      task_date: taskData.taskDate,
      year_month: taskData.yearMonth,
      cw_week: taskData.cwWeek,
      day_of_month: taskData.dayOfMonth,
      topic: taskData.topic || null,
      task_type: taskData.taskType,
      task_type_code: taskData.taskType,  // 兼容旧字段
      location: taskData.location || null,
      // 兼容旧字段：填充start_week, end_week, start_date, end_date
      start_week: taskData.cwWeek,
      end_week: taskData.cwWeek,
      start_date: taskData.taskDate,
      end_date: taskData.taskDate,
      import_batch_id: parseResult.batchId,
      source_file_name: parseResult.fileName,
    });
  }

  console.log('✅ 转换完成:', {
    原始任务数: parseResult.dailyTasks.length,
    成功转换: tasks.length,
    未匹配员工: warnings.length,
  });

  // 去重警告
  const uniqueWarnings = Array.from(new Set(warnings));

  return {
    success: tasks.length > 0,
    tasks,
    errors,
    warnings: uniqueWarnings,
  };
}

/**
 * 一键导入：解析 + 转换 + 插入数据库（V2版本）
 */
export async function importResourcePlanningExcelV2(
  file: File,
  year: number = new Date().getFullYear()
): Promise<{
  success: boolean;
  importedCount: number;
  errors: string[];
  warnings: string[];
  batchId: string;
}> {
  try {
    console.log('🚀 开始导入资源规划Excel（V2版本）');

    // 1. 解析Excel
    const parseResult = await parseResourcePlanningExcelV2(file, year);
    if (!parseResult.success || !parseResult.dailyTasks) {
      return {
        success: false,
        importedCount: 0,
        errors: parseResult.errors || ['解析失败'],
        warnings: parseResult.warnings || [],
        batchId: parseResult.batchId,
      };
    }

    // 2. 获取员工列表
    const { supabaseService } = await import('./supabaseService');
    const employees = await supabaseService.getAllEmployees();

    console.log('📋 员工列表:', employees.map((e: any) => e.name));

    // 3. 转换为数据库格式
    const convertResult = await convertToDailyDbFormat(parseResult, employees);
    if (!convertResult.success || convertResult.tasks.length === 0) {
      return {
        success: false,
        importedCount: 0,
        errors: convertResult.errors,
        warnings: convertResult.warnings,
        batchId: parseResult.batchId,
      };
    }

    // 4. 批量插入数据库
    await supabaseService.batchImportResourceTasksDaily(convertResult.tasks);

    console.log('✅ 导入成功！');

    return {
      success: true,
      importedCount: convertResult.tasks.length,
      errors: convertResult.errors,
      warnings: convertResult.warnings,
      batchId: parseResult.batchId,
    };

  } catch (error: any) {
    console.error('❌ 导入失败:', error);
    return {
      success: false,
      importedCount: 0,
      errors: [error.message],
      warnings: [],
      batchId: crypto.randomUUID(),
    };
  }
}
