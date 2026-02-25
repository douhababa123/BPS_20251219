"""
创建 Excel 测试文件
用于测试 pandas 集成的 Excel 导入功能
"""
import pandas as pd
import os

# 创建 test_data 目录（如果不存在）
os.makedirs('test_data', exist_ok=True)

# 1. 创建部门 Excel 文件
departments_data = {
    'ID': ['', '', ''],
    '部门名称': ['XLSXTEST1', 'XLSXTEST2', 'XLSXTEST3'],
    '部门代码': ['XLSX001', 'XLSX002', 'XLSX003'],
    '描述': ['Excel导入测试部门1', 'Excel导入测试部门2', 'Excel导入测试部门3']
}
df_dept = pd.DataFrame(departments_data)
df_dept.to_excel('test_data/departments_import.xlsx', index=False)
print("✅ 创建 test_data/departments_import.xlsx")

# 2. 创建员工 Excel 文件
employees_data = {
    'ID': ['', '', ''],
    '员工工号': ['XLSX_EMP001', 'XLSX_EMP002', 'XLSX_EMP003'],
    '姓名': ['Excel员工1', 'Excel员工2', 'Excel员工3'],
    '部门ID': ['1', '1', '2'],
    '邮箱': ['xlsx1@bosch.com', 'xlsx2@bosch.com', 'xlsx3@bosch.com'],
    '职位': ['工程师', '经理', '工程师'],
    '电话': ['13800001111', '13800002222', '13800003333']
}
df_emp = pd.DataFrame(employees_data)
df_emp.to_excel('test_data/employees_import.xlsx', index=False)
print("✅ 创建 test_data/employees_import.xlsx")

# 3. 创建技能 Excel 文件
skills_data = {
    'ID': ['', '', ''],
    '模块ID': ['99', '99', '99'],
    '模块名称': ['Excel测试模块', 'Excel测试模块', 'Excel测试模块'],
    '技能名称': ['Excel技能1', 'Excel技能2', 'Excel技能3'],
    '技能代码': ['XLSXSKILL1', 'XLSXSKILL2', 'XLSXSKILL3'],
    '描述': ['Excel导入测试技能1', 'Excel导入测试技能2', 'Excel导入测试技能3'],
    '显示顺序': ['9001', '9002', '9003']
}
df_skill = pd.DataFrame(skills_data)
df_skill.to_excel('test_data/skills_import.xlsx', index=False)
print("✅ 创建 test_data/skills_import.xlsx")

print("\n✅ 所有 Excel 测试文件创建完成！")
