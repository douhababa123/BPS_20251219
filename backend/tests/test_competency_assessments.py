"""
能力评估模块测试
测试 /api/competency-assessments 端点的CRUD操作
"""
import pytest
import requests
from typing import List


class TestCompetencyAssessments:
    """能力评估API测试类"""
    
    def test_get_all_assessments(self, api_base_url):
        """测试获取所有能力评估"""
        response = requests.get(f"{api_base_url}/competency-assessments")
        
        # 验证响应状态
        assert response.status_code == 200, f"期待200，实际{response.status_code}"
        
        # 验证响应数据
        data = response.json()
        assert isinstance(data, list), "返回数据应该是列表"
        assert len(data) > 0, "应该至少有一条能力评估记录"
        
        # 验证第一条记录的结构
        first_item = data[0]
        required_fields = [
            'employee_id', 'skill_id', 'current_level', 
            'target_level', 'gap'
        ]
        for field in required_fields:
            assert field in first_item, f"缺少必填字段: {field}"
        
        print(f"✅ 成功获取{len(data)}条能力评估记录")
    
    
    def test_assessments_data_integrity(self, api_base_url):
        """测试能力评估数据完整性和类型"""
        response = requests.get(f"{api_base_url}/competency-assessments")
        assert response.status_code == 200
        
        data = response.json()
        
        # 验证每条记录的数据类型和值
        for item in data:
            assert isinstance(item['skill_id'], int), "skill_id应该是整数"
            assert isinstance(item['current_level'], int), "current_level应该是整数"
            assert isinstance(item['target_level'], int), "target_level应该是整数"
            assert isinstance(item['gap'], int), "gap应该是整数"
            
            # 验证级别值的合理性（0-5的范围）
            assert 0 <= item['current_level'] <= 5, \
                f"current_level应该在0-5之间，实际: {item['current_level']}"
            assert 0 <= item['target_level'] <= 5, \
                f"target_level应该在0-5之间，实际: {item['target_level']}"
            
            # 验证gap的计算准确性
            expected_gap = item['target_level'] - item['current_level']
            assert item['gap'] == expected_gap, \
                f"gap计算错误: 期待{expected_gap}，实际{item['gap']}"
        
        print(f"✅ 数据完整性验证通过，检查了{len(data)}条记录")
    
    
    def test_level_validation_allows_high_values(self, api_base_url, db_cursor):
        """测试验证规则允许高级别值（修复后应该支持level=4和5）"""
        # 查找current_level或target_level >= 4的记录
        db_cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.competency_assessments
            WHERE current_level >= 4 OR target_level >= 4
        """)
        high_level_count = db_cursor.fetchone()[0]
        
        if high_level_count > 0:
            print(f"数据库中有{high_level_count}条记录的级别>=4")
            
            # API应该能正常返回这些记录
            response = requests.get(f"{api_base_url}/competency-assessments")
            assert response.status_code == 200, \
                "API应该能处理高级别值（4和5）的记录"
            
            data = response.json()
            api_high_level_count = sum(
                1 for item in data 
                if item['current_level'] >= 4 or item['target_level'] >= 4
            )
            
            assert api_high_level_count == high_level_count, \
                f"API返回的高级别记录数({api_high_level_count})与数据库({high_level_count})不一致"
            
            print(f"✅ 验证规则正确支持高级别值，处理了{high_level_count}条记录")
        else:
            print("⚠️ 数据库中没有级别>=4的记录，跳过此测试")
    
    
    def test_assessments_by_employee(self, api_base_url, db_cursor):
        """测试按员工筛选能力评估"""
        # 从数据库获取一个有评估记录的员工ID
        db_cursor.execute("""
            SELECT TOP 1 employee_id, COUNT(*) as assessment_count
            FROM dbo.competency_assessments
            GROUP BY employee_id
            ORDER BY COUNT(*) DESC
        """)
        row = db_cursor.fetchone()
        
        if row:
            employee_id = row[0]
            expected_count = row[1]
            
            # 测试API按员工ID筛选（使用路径参数）
            response = requests.get(
                f"{api_base_url}/competency-assessments/employee/{str(employee_id)}"
            )
            assert response.status_code == 200, \
                f"API调用失败: {response.status_code} - {response.text}"
            
            data = response.json()
            assert len(data) == expected_count, \
                f"员工{employee_id}的评估数量应该是{expected_count}，实际{len(data)}"
            
            # 验证所有记录都属于这个员工
            for item in data:
                assert item['employee_id'] == str(employee_id), \
                    "筛选结果中包含了其他员工的记录"
            
            print(f"✅ 按员工筛选功能正常，员工{employee_id}有{len(data)}条评估")
    
    
    def test_database_record_count_matches_api(self, api_base_url, db_cursor):
        """测试数据库记录数与API返回数量一致"""
        # 从数据库直接查询记录数
        db_cursor.execute("SELECT COUNT(*) FROM dbo.competency_assessments")
        db_count = db_cursor.fetchone()[0]
        
        # 从API获取记录数
        response = requests.get(f"{api_base_url}/competency-assessments")
        assert response.status_code == 200
        api_count = len(response.json())
        
        # 验证一致性
        assert db_count == api_count, \
            f"数据库记录数({db_count})与API返回数({api_count})不一致"
        
        print(f"✅ 数据库和API记录数一致: {db_count}条")
    
    
    def test_notes_field_mapping(self, api_base_url, db_cursor):
        """测试notes字段正确映射为assessor_notes"""
        # 从数据库获取有notes的记录
        db_cursor.execute("""
            SELECT TOP 3 id, notes
            FROM dbo.competency_assessments
            WHERE notes IS NOT NULL AND notes != ''
            ORDER BY created_at DESC
        """)
        db_records = db_cursor.fetchall()
        
        if len(db_records) > 0:
            # 从API获取所有记录
            response = requests.get(f"{api_base_url}/competency-assessments")
            assert response.status_code == 200
            api_records = response.json()
            
            # 验证notes映射
            for db_row in db_records:
                db_id, db_notes = db_row
                
                # 在API结果中找到相同ID的记录
                api_record = next((r for r in api_records if r['id'] == str(db_id)), None)
                if api_record and 'assessor_notes' in api_record:
                    # 验证notes映射到assessor_notes
                    assert api_record['assessor_notes'] == db_notes, \
                        f"ID={db_id}: assessor_notes值不匹配"
                    print(f"✅ ID={db_id}: notes正确映射到assessor_notes")
        else:
            print("⚠️ 数据库中没有带notes的记录，跳过此测试")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
