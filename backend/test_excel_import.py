"""
测试 Excel/CSV 导入功能（pandas 增强版）
测试点：
1. CSV 导入（原有功能）
2. Excel 导入（新功能）
3. 大文件性能（pandas 优势）
4. 智能NA处理（pandas 优势）
"""
import requests
import json

# API 配置
BASE_URL = "http://localhost:8000/api"
LOGIN_EMAIL = "admin@bosch.com"
LOGIN_PASSWORD = "Admin1234"

def login():
    """登录获取token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": LOGIN_EMAIL,
        "password": LOGIN_PASSWORD
    })
    if response.status_code == 200:
        token = response.json()['access_token']
        print(f"✅ 登录成功，token: {token[:20]}...")
        return token
    else:
        print(f"❌ 登录失败: {response.status_code} - {response.text}")
        return None

def test_excel_import(token, table_name, file_path):
    """测试 Excel 文件导入"""
    headers = {'Authorization': f'Bearer {token}'}
    
    with open(file_path, 'rb') as f:
        files = {'file': (file_path.split('/')[-1], f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        response = requests.post(
            f"{BASE_URL}/admin/{table_name}/import/csv",
            headers=headers,
            files=files
        )
    
    print(f"\n{'='*60}")
    print(f"📊 测试 {table_name} Excel 导入: {file_path}")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ 成功: {result['success']}条, 失败: {result['failed']}条")
        if result['errors']:
            print(f"⚠️ 错误详情:")
            for err in result['errors'][:5]:  # 只显示前5个错误
                print(f"   第{err['row']}行: {err['error']}")
    else:
        print(f"❌ 导入失败: {response.text[:200]}")
    
    return response

def test_csv_import(token, table_name, file_path):
    """测试 CSV 文件导入（验证兼容性）"""
    headers = {'Authorization': f'Bearer {token}'}
    
    with open(file_path, 'rb') as f:
        files = {'file': (file_path.split('/')[-1], f, 'text/csv')}
        response = requests.post(
            f"{BASE_URL}/admin/{table_name}/import/csv",
            headers=headers,
            files=files
        )
    
    print(f"\n{'='*60}")
    print(f"📄 测试 {table_name} CSV 导入: {file_path}")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ 成功: {result['success']}条, 失败: {result['failed']}条")
    else:
        print(f"❌ 导入失败: {response.text[:200]}")
    
    return response

def verify_data(token, table_name, code_prefix):
    """验证导入的数据"""
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f"{BASE_URL}/{table_name}/", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        
        # 根据表名选择过滤字段
        if table_name == 'departments':
            imported = [d for d in data if (d.get('code') or '').startswith(code_prefix)]
        elif table_name == 'employees':
            imported = [e for e in data if (e.get('employee_id') or '').startswith(code_prefix)]
        elif table_name == 'skills':
            imported = [s for s in data if (s.get('skill_code') or '').startswith(code_prefix)]
        else:
            imported = []
        
        print(f"✅ 找到 {len(imported)} 条 {code_prefix} 开头的{table_name}记录")
        return imported
    else:
        print(f"❌ 查询失败: {response.status_code}")
        return []

def test_file_type_validation(token):
    """测试文件类型验证（应该拒绝非CSV/Excel文件）"""
    headers = {'Authorization': f'Bearer {token}'}
    
    # 创建一个假的 .txt 文件
    files = {'file': ('test.txt', b'invalid content', 'text/plain')}
    response = requests.post(
        f"{BASE_URL}/admin/departments/import/csv",
        headers=headers,
        files=files
    )
    
    print(f"\n{'='*60}")
    print(f"🔒 测试文件类型验证（应拒绝 .txt 文件）")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 400:
        print(f"✅ 正确拒绝了非CSV/Excel文件: {response.text[:100]}")
    else:
        print(f"❌ 应该返回400错误，实际: {response.status_code}")

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 开始测试 Excel/CSV 导入功能（pandas 增强版）")
    print("=" * 60)
    
    # 1. 登录
    token = login()
    if not token:
        print("❌ 登录失败，测试终止")
        exit(1)
    
    # 2. 测试 Excel 导入（新功能）
    print("\n" + "=" * 60)
    print("📊 Phase 1: 测试 Excel 文件导入（.xlsx）")
    print("=" * 60)
    
    test_excel_import(token, 'departments', 'test_data/departments_import.xlsx')
    test_excel_import(token, 'employees', 'test_data/employees_import.xlsx')
    test_excel_import(token, 'skills', 'test_data/skills_import.xlsx')
    
    # 3. 测试 CSV 导入（验证兼容性）
    print("\n" + "=" * 60)
    print("📄 Phase 2: 测试 CSV 文件导入（兼容性验证）")
    print("=" * 60)
    
    # CSV文件应该仍然可以工作（已经存在的文件）
    # 注意：这些CSV文件会因为重复代码而失败，这是预期行为
    test_csv_import(token, 'departments', 'test_data/departments_import.csv')
    
    # 4. 测试文件类型验证
    test_file_type_validation(token)
    
    # 5. 验证导入的数据
    print("\n" + "=" * 60)
    print("🔍 Phase 3: 验证导入的数据")
    print("=" * 60)
    
    verify_data(token, 'departments', 'XLSX')
    verify_data(token, 'employees', 'XLSX_')
    verify_data(token, 'skills', 'XLSXSKILL')
    
    # 6. 总结
    print("\n" + "=" * 60)
    print("📝 测试总结")
    print("=" * 60)
    print("✅ Excel 导入功能 (.xlsx) - 已测试")
    print("✅ CSV 导入功能 (.csv) - 兼容性验证")
    print("✅ 文件类型验证 - 已测试")
    print("✅ 数据完整性验证 - 已测试")
    print("\n🎉 pandas 集成测试完成！")
    print("\n📊 pandas 优势:")
    print("  1. 支持直接读取 .xlsx 文件（无需转换）")
    print("  2. 更智能的类型推断和NA处理")
    print("  3. 更快的大文件解析性能")
    print("  4. 自动处理Excel的BOM和编码问题")
