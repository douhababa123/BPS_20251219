/**
 * Excel资源规划解析工具
 * 
 * 功能：
 * 1. 解析标准格式Excel（示例1：每个单元格一个任务）
 * 2. 处理合并单元格（跨周任务）
 * 3. 识别周数格式（CW23, CW24...）
 * 4. 映射任务类型代码
 * 5. 生成导入数据
 * 
 * Excel结构：
 * - 第1行：周数表头（CW23, CW24, CW25...）
 * - 第2行开始：员工名称 + 任务数据
 * - 任务格式：缩写代码（如WS, P, T）或完整名称
 */

import * as XLSX from 'xlsx';
import type { ExcelParseResult, ExcelTaskData } from './database.types';
import { supabaseService } from './supabaseService';

/**
 * 解析Excel文件
 * @param file Excel文件对象
 * @param year 年份（用于周数转日期）
 */
export async function parseResourcePlanningExcel(
  file: File,
  _year: number = new Date().getFullYear()
): Promise<ExcelParseResult> {
  const batchId = crypto.randomUUID();
  const errors: string[] = [];
  const warnings: string[] = [];
  const taskData: ExcelTaskData[] = [];

  try {
    // 1. 读取Excel文件
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: true,
      cellStyles: true 
    });

    // 2. 获取第一个工作表
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 3. 转换为JSON（保留空单元格）
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,  // 使用数组格式（不自动识别表头）
      defval: '',  // 空单元格默认值
      blankrows: false  // 跳过空行
    }) as any[][];

    if (jsonData.length < 2) {
      errors.push('Excel文件格式错误：至少需要2行数据（表头 + 数据行）');
      return {
        success: false,
        errors,
        fileName: file.name,
        batchId,
        totalRows: 0,
        parsedRows: 0,
      };
    }

    // 4. 解析表头（第1行：周数）
    const headerRow = jsonData[0];
    const weekColumns = parseWeekHeader(headerRow);

    if (weekColumns.length === 0) {
      errors.push('未找到有效的周数列（格式应为：CW23, CW24...）');
      return {
        success: false,
        errors,
        fileName: file.name,
        batchId,
        totalRows: jsonData.length - 1,
        parsedRows: 0,
      };
    }

    // 5. 解析数据行（从第2行开始）
    for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
      const row = jsonData[rowIndex];
      const employeeName = String(row[0] || '').trim();

      // 跳过空行或无员工名称的行
      if (!employeeName) {
        continue;
      }

      // 解析该员工的所有任务
      const employeeTasks = parseEmployeeRow(
        employeeName,
        row,
        weekColumns,
        rowIndex + 1  // Excel行号（从1开始）
      );

      taskData.push(...employeeTasks);
    }

    // 6. 验证和警告
    if (taskData.length === 0) {
      warnings.push('未找到任何任务数据');
    }

    // 统计各任务类型
    const taskTypeCounts = new Map<string, number>();
    taskData.forEach(task => {
      taskTypeCounts.set(
        task.taskTypeCode,
        (taskTypeCounts.get(task.taskTypeCode) || 0) + 1
      );
    });

    console.log('📊 解析统计:', {
      总行数: jsonData.length - 1,
      有效员工数: new Set(taskData.map(t => t.employeeName)).size,
      任务总数: taskData.length,
      任务类型分布: Object.fromEntries(taskTypeCounts),
    });

    return {
      success: true,
      data: taskData,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      fileName: file.name,
      batchId,
      totalRows: jsonData.length - 1,
      parsedRows: taskData.length,
    };

  } catch (error: any) {
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
 * 解析表头，提取周数列
 * @param headerRow 表头行数据
 * @returns 周数列信息 { columnIndex, weekStr }
 */
function parseWeekHeader(headerRow: any[]): Array<{ columnIndex: number; weekStr: string }> {
  const weekColumns: Array<{ columnIndex: number; weekStr: string }> = [];
  
  // 更宽松的正则表达式，匹配多种格式
  const weekRegexes = [
    /CW\s*(\d{1,2})/i,           // CW23, CW 23, cw23
    /W\s*(\d{1,2})/i,            // W23, W 23
    /Week\s*(\d{1,2})/i,         // Week 23, week23
    /第\s*(\d{1,2})\s*周/,       // 第23周
    /^\s*(\d{1,2})\s*$/,         // 纯数字 "23"
  ];

  console.log('📋 开始解析表头，总列数:', headerRow.length);
  console.log('📋 表头原始数据:', headerRow);

  for (let colIndex = 1; colIndex < headerRow.length; colIndex++) {
    const cellValue = String(headerRow[colIndex] || '').trim();
    
    // 跳过空单元格
    if (!cellValue) continue;

    // 尝试所有正则表达式
    let weekNumber: string | null = null;
    for (const regex of weekRegexes) {
      const match = cellValue.match(regex);
      if (match) {
        weekNumber = match[1].padStart(2, '0');
        break;
      }
    }

    if (weekNumber) {
      const weekStr = `CW${weekNumber}`;
      weekColumns.push({
        columnIndex: colIndex,
        weekStr: weekStr,
      });
      console.log(`  ✅ 列${colIndex}: "${cellValue}" → ${weekStr}`);
    } else {
      console.log(`  ⚠️ 列${colIndex}: "${cellValue}" → 无法识别为周数`);
    }
  }

  console.log('📊 解析结果: 找到', weekColumns.length, '个周数列');
  return weekColumns;
}

/**
 * 解析单个员工的任务行
 * @param employeeName 员工姓名
 * @param row 行数据
 * @param weekColumns 周数列信息
 * @param excelRowNumber Excel行号
 * @returns 任务数据数组
 */
function parseEmployeeRow(
  employeeName: string,
  row: any[],
  weekColumns: Array<{ columnIndex: number; weekStr: string }>,
  excelRowNumber: number
): ExcelTaskData[] {
  const tasks: ExcelTaskData[] = [];
  let currentTask: ExcelTaskData | null = null;

  for (let i = 0; i < weekColumns.length; i++) {
    const { columnIndex, weekStr } = weekColumns[i];
    const cellValue = String(row[columnIndex] || '').trim();

    // 空单元格
    if (!cellValue) {
      // 如果有正在进行的任务，结束它
      if (currentTask) {
        tasks.push(currentTask);
        currentTask = null;
      }
      continue;
    }

    // 提取任务类型代码（可能是缩写如"WS"，或完整名称如"Workshop"）
    const taskTypeCode = extractTaskTypeCode(cellValue);

    // 如果当前已有任务，且新单元格的任务类型与之相同
    // 说明这是合并单元格（跨周任务），扩展结束周
    if (currentTask && currentTask.taskTypeCode === taskTypeCode) {
      currentTask.endWeek = weekStr;
      continue;
    }

    // 否则，保存之前的任务（如果有），开始新任务
    if (currentTask) {
      tasks.push(currentTask);
    }

    currentTask = {
      employeeName,
      taskTypeCode,
      startWeek: weekStr,
      endWeek: weekStr,
      topic: extractTaskTopic(cellValue),
      rowIndex: excelRowNumber,
    };
  }

  // 保存最后一个任务
  if (currentTask) {
    tasks.push(currentTask);
  }

  return tasks;
}

/**
 * 提取任务类型代码
 * 优先匹配预设的缩写代码（WS, P, T等）
 * 如果没有匹配，返回原始值的前2个字符作为代码
 */
function extractTaskTypeCode(cellValue: string): string {
  const upperValue = cellValue.toUpperCase();

  // 预设的任务类型代码（与数据库预设一致）
  const knownCodes = ['WS', 'SW', 'P', 'T', 'C', 'M', 'L', 'SD', 'A', 'S', 'O'];

  // 优先匹配完整代码
  for (const code of knownCodes) {
    if (upperValue.startsWith(code)) {
      return code;
    }
  }

  // 尝试匹配完整名称
  const codeMapping: Record<string, string> = {
    'WORKSHOP': 'WS',
    'SPEED WEEK': 'SW',
    'SPEEDWEEK': 'SW',
    'PROJECT': 'P',
    'TRAINING': 'T',
    'COACHING': 'C',
    'MEETING': 'M',
    'LEAVE': 'L',
    'SELF-DEVELOP': 'SD',
    'SELFDEVELOP': 'SD',
    'ASSESSMENT': 'A',
    'SUPPORT': 'S',
    'OTHERS': 'O',
    'OTHER': 'O',
  };

  for (const [keyword, code] of Object.entries(codeMapping)) {
    if (upperValue.includes(keyword)) {
      return code;
    }
  }

  // 如果都不匹配，返回前2个字符（去掉空格）
  return cellValue.replace(/\s/g, '').substring(0, 2).toUpperCase() || 'O';
}

/**
 * 提取任务主题（如果有）
 * 例如："WS - BPS Workshop" -> "BPS Workshop"
 */
function extractTaskTopic(cellValue: string): string | undefined {
  // 如果包含分隔符（-、:、/等），提取后面的内容
  const separators = ['-', ':', '/'];
  for (const sep of separators) {
    const parts = cellValue.split(sep);
    if (parts.length > 1) {
      const topic = parts.slice(1).join(sep).trim();
      if (topic) {
        return topic;
      }
    }
  }

  // 如果单元格内容较长（>5个字符），且不只是代码，认为是主题
  if (cellValue.length > 5 && !/^[A-Z]{1,2}$/.test(cellValue)) {
    return cellValue;
  }

  return undefined;
}

/**
 * 将解析结果转换为数据库插入格式
 * @param parseResult 解析结果
 * @param employees 员工列表（用于匹配）
 * @param year 年份
 */
export async function convertToDbFormat(
  parseResult: ExcelParseResult,
  employees: Array<{ id: string; name: string; employee_id: string }>,
  year: number = new Date().getFullYear()
): Promise<{
  success: boolean;
  tasks: Array<{
    employee_id: string;
    task_type_code: string;
    start_week: string;
    end_week: string;
    start_date: string;
    end_date: string;
    topic?: string;
    location?: string;
    notes?: string;
    import_batch_id: string;
    source_file_name: string;
  }>;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tasks: any[] = [];

  if (!parseResult.success || !parseResult.data) {
    return {
      success: false,
      tasks: [],
      errors: ['解析失败，无数据'],
      warnings: [],
    };
  }

  // 创建员工名称索引
  const employeeMap = new Map<string, { id: string; name: string }>();
  employees.forEach(emp => {
    employeeMap.set(emp.name.toLowerCase(), { id: emp.id, name: emp.name });
    // 同时索引工号（如果有）
    if (emp.employee_id) {
      employeeMap.set(emp.employee_id.toLowerCase(), { id: emp.id, name: emp.name });
    }
  });

  // 转换每个任务
  for (const taskData of parseResult.data) {
    // 1. 匹配员工ID
    const employee = employeeMap.get(taskData.employeeName.toLowerCase());
    if (!employee) {
      warnings.push(`第${taskData.rowIndex}行: 未找到员工 "${taskData.employeeName}"`);
      continue;
    }

    // 2. 转换周数为日期
    const { startDate, endDate } = supabaseService.weekRangeToDateRange(
      taskData.startWeek,
      taskData.endWeek,
      year
    );

    // 3. 组装任务数据
    tasks.push({
      employee_id: employee.id,
      task_type_code: taskData.taskTypeCode,
      start_week: taskData.startWeek,
      end_week: taskData.endWeek,
      start_date: startDate,
      end_date: endDate,
      topic: taskData.topic,
      location: taskData.location,
      notes: taskData.notes,
      import_batch_id: parseResult.batchId,
      source_file_name: parseResult.fileName,
    });
  }

  // 统计
  console.log('✅ 转换完成:', {
    原始任务数: parseResult.data.length,
    成功转换: tasks.length,
    未匹配员工: warnings.length,
  });

  return {
    success: tasks.length > 0,
    tasks,
    errors,
    warnings,
  };
}

/**
 * 一键导入：解析 + 转换 + 插入数据库
 * @param file Excel文件
 * @param year 年份
 */
export async function importResourcePlanningExcel(
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
    // 1. 解析Excel
    const parseResult = await parseResourcePlanningExcel(file, year);
    if (!parseResult.success || !parseResult.data) {
      return {
        success: false,
        importedCount: 0,
        errors: parseResult.errors || ['解析失败'],
        warnings: parseResult.warnings || [],
        batchId: parseResult.batchId,
      };
    }

    // 2. 获取员工列表
    const employees = await supabaseService.getAllEmployees();

    // 3. 转换为数据库格式
    const convertResult = await convertToDbFormat(parseResult, employees, year);
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
    await supabaseService.batchImportResourceTasks(convertResult.tasks);

    return {
      success: true,
      importedCount: convertResult.tasks.length,
      errors: convertResult.errors,
      warnings: convertResult.warnings,
      batchId: parseResult.batchId,
    };

  } catch (error: any) {
    return {
      success: false,
      importedCount: 0,
      errors: [error.message],
      warnings: [],
      batchId: crypto.randomUUID(),
    };
  }
}
