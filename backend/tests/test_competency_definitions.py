"""
能力定义模块测试
测试 /api/competency-definitions 端点的CRUD操作
"""
import pytest
import requests
from typing import List


class TestCompetencyDefinitions:
    """能力定义API测试类"""
    
    def test_get_all_definitions(self, api_base_url):
        """测试获取所有能力定义"""
        response = requests.get(f"{api_base_url}/competency-definitions")
        
        # 验证响应状态
        assert response.status_code == 200, f"期待200，实际{response.status_code}"
        
        # 验证响应数据
        data = response.json()
        assert isinstance(data, list), "返回数据应该是列表"
        assert len(data) > 0, "应该至少有一条能力定义记录"
        
        # 验证第一条记录的结构
        first_item = data[0]
        required_fields = [
            'id', 'module_id', 'module_name', 'competency_type', 
            'competency_code', 'competency_name', 'is_active'
        ]
        for field in required_fields:
            assert field in first_item, f"缺少必填字段: {field}"
        
        print(f"✅ 成功获取{len(data)}条能力定义记录")
    
    
    def test_definitions_data_integrity(self, api_base_url):
        """测试能力定义数据完整性"""
        response = requests.get(f"{api_base_url}/competency-definitions")
        assert response.status_code == 200
        
        data = response.json()
        
        # 验证每条记录的数据类型和值
        for item in data:
            assert isinstance(item['id'], int), "id应该是整数"
            assert isinstance(item['module_id'], int), "module_id应该是整数"
            assert isinstance(item['module_name'], str), "module_name应该是字符串"
            assert isinstance(item['competency_type'], str), "competency_type应该是字符串"
            assert isinstance(item['competency_name'], str), "competency_name应该是字符串"
            assert isinstance(item['is_active'], bool), "is_active应该是布尔值"
            
            # 验证值的合理性
            assert item['id'] > 0, "id应该是正整数"
            assert len(item['module_name']) > 0, "module_name不应为空"
            assert len(item['competency_name']) > 0, "competency_name不应为空"
        
        print(f"✅ 数据完整性验证通过，检查了{len(data)}条记录")
    
    
    def test_definitions_grouped_by_module(self, api_base_url):
        """测试按模块分组的能力定义"""
        response = requests.get(f"{api_base_url}/competency-definitions")
        assert response.status_code == 200
        
        data = response.json()
        
        # 统计每个模块的能力定义数量
        modules = {}
        for item in data:
            module_name = item['module_name']
            if module_name not in modules:
                modules[module_name] = []
            modules[module_name].append(item)
        
        print(f"\n📊 能力定义按模块分布:")
        for module_name, items in modules.items():
            print(f"  {module_name}: {len(items)}条")
        
        assert len(modules) > 0, "应该至少有一个模块"
    
    
    def test_database_record_count_matches_api(self, api_base_url, db_cursor):
        """测试数据库记录数与API返回数量一致"""
        # 从数据库直接查询记录数
        db_cursor.execute("SELECT COUNT(*) FROM dbo.competency_definitions")
        db_count = db_cursor.fetchone()[0]
        
        # 从API获取记录数
        response = requests.get(f"{api_base_url}/competency-definitions")
        assert response.status_code == 200
        api_count = len(response.json())
        
        # 验证一致性
        assert db_count == api_count, \
            f"数据库记录数({db_count})与API返回数({api_count})不一致"
        
        print(f"✅ 数据库和API记录数一致: {db_count}条")
    
    
    def test_competency_type_mapping(self, api_base_url, db_cursor):
        """测试competency_type正确映射为competency_name"""
        # 从数据库获取前5条记录
        db_cursor.execute("""
            SELECT TOP 5 id, competency_type, description
            FROM dbo.competency_definitions
            ORDER BY id
        """)
        db_records = db_cursor.fetchall()
        
        # 从API获取相同记录
        response = requests.get(f"{api_base_url}/competency-definitions")
        assert response.status_code == 200
        api_records = response.json()
        
        # 验证映射
        for db_row in db_records:
            db_id, db_competency_type, db_description = db_row
            
            # 在API结果中找到相同ID的记录
            api_record = next((r for r in api_records if r['id'] == db_id), None)
            assert api_record is not None, f"API中未找到ID={db_id}的记录"
            
            # 验证competency_type映射到competency_name（因为description都是NULL）
            assert api_record['competency_name'] == db_competency_type, \
                f"ID={db_id}: competency_name应该是competency_type的值"
            
            print(f"✅ ID={db_id}: '{db_competency_type}' 正确映射")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
