"""
审计日志系统测试用例
Phase 2: 审计日志系统

测试范围：
1. 审计日志表结构验证
2. 审计日志记录功能
3. 审计日志查询功能
4. 权限验证（仅管理员可查询）
"""

import pytest
from database import db
from datetime import datetime, timedelta


# ============================================================================
# 全局 Fixtures
# ============================================================================

@pytest.fixture
def test_user():
    """创建测试用户（全局 fixture）"""
    with db.get_cursor() as cursor:
        # 查找或创建测试用户
        cursor.execute("""
            SELECT id, name, email
            FROM dbo.users
            WHERE email = 'test_audit@bosch.com'
        """)
        user = cursor.fetchone()
        
        if not user:
            from auth import hash_password
            cursor.execute("""
                INSERT INTO dbo.users (email, password_hash, name, role)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.email
                VALUES (?, ?, ?, 'admin')
            """, ('test_audit@bosch.com', hash_password('Test1234'), '审计测试用户'))
            user = cursor.fetchone()
        
        return {
            'user_id': str(user[0]),
            'name': user[1],
            'email': user[2]
        }


class TestAuditLogsTable:
    """测试审计日志表结构"""
    
    def test_audit_logs_table_exists(self):
        """测试 data_audit_logs 表是否存在"""
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'data_audit_logs'
            """)
            result = cursor.fetchone()
            assert result[0] == 1, "data_audit_logs 表应该存在"
    
    def test_audit_logs_table_has_required_columns(self):
        """测试审计日志表包含所有必需字段"""
        required_columns = [
            'id', 'table_name', 'record_id', 'operation_type',
            'field_name', 'old_value', 'new_value',
            'operator_id', 'operator_name', 'operator_email',
            'operated_at'
        ]
        
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'data_audit_logs'
            """)
            columns = [row[0] for row in cursor.fetchall()]
            
            for col in required_columns:
                assert col in columns, f"字段 {col} 应该存在"
    
    def test_audit_logs_operation_type_constraint(self):
        """测试 operation_type 的 CHECK 约束"""
        with db.get_cursor() as cursor:
            # 查询约束定义
            cursor.execute("""
                SELECT CHECK_CLAUSE
                FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
                WHERE CONSTRAINT_NAME = 'CHK_audit_logs_operation_type'
            """)
            result = cursor.fetchone()
            assert result is not None, "operation_type 应该有 CHECK 约束"
            
            constraint = result[0].upper()
            assert 'INSERT' in constraint, "约束应包含 INSERT"
            assert 'UPDATE' in constraint, "约束应包含 UPDATE"
            assert 'DELETE' in constraint, "约束应包含 DELETE"
    
    def test_audit_logs_has_indexes(self):
        """测试审计日志表有必要的索引"""
        expected_indexes = [
            'IDX_audit_logs_table_name',
            'IDX_audit_logs_operator',
            'IDX_audit_logs_operated_at',
            'IDX_audit_logs_record'
        ]
        
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT name
                FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.data_audit_logs')
                    AND name IS NOT NULL
            """)
            indexes = [row[0] for row in cursor.fetchall()]
            
            for idx in expected_indexes:
                assert idx in indexes, f"索引 {idx} 应该存在"


class TestAuditLogRecording:
    """测试审计日志记录功能"""
    
    def test_log_insert_operation(self, test_user):
        """测试记录 INSERT 操作"""
        from audit import log_audit
        
        # 记录一次插入操作
        log_data = {
            'table_name': 'departments',
            'record_id': 'test-dept-001',
            'operation_type': 'INSERT',
            'field_name': None,
            'old_value': None,
            'new_value': '{"name": "测试部门", "code": "TEST"}',
            'operator_id': test_user['user_id'],
            'operator_name': test_user['name'],
            'operator_email': test_user['email']
        }
        
        log_id = log_audit(**log_data)
        assert log_id is not None, "应该返回日志ID"
        
        # 验证日志已保存
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT table_name, operation_type, new_value
                FROM dbo.data_audit_logs
                WHERE id = ?
            """, (log_id,))
            result = cursor.fetchone()
            
            assert result is not None, "日志应该被保存"
            assert result[0] == 'departments', "表名应该正确"
            assert result[1] == 'INSERT', "操作类型应该是 INSERT"
    
    def test_log_update_operation(self, test_user):
        """测试记录 UPDATE 操作"""
        from audit import log_audit
        
        # 记录一次更新操作（单个字段）
        log_data = {
            'table_name': 'employees',
            'record_id': 'test-emp-001',
            'operation_type': 'UPDATE',
            'field_name': 'department_id',
            'old_value': 'dept-001',
            'new_value': 'dept-002',
            'operator_id': test_user['user_id'],
            'operator_name': test_user['name'],
            'operator_email': test_user['email']
        }
        
        log_id = log_audit(**log_data)
        assert log_id is not None, "应该返回日志ID"
        
        # 验证字段级变更被记录
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT field_name, old_value, new_value
                FROM dbo.data_audit_logs
                WHERE id = ?
            """, (log_id,))
            result = cursor.fetchone()
            
            assert result[0] == 'department_id', "字段名应该正确"
            assert result[1] == 'dept-001', "旧值应该正确"
            assert result[2] == 'dept-002', "新值应该正确"
    
    def test_log_delete_operation(self, test_user):
        """测试记录 DELETE 操作"""
        from audit import log_audit
        
        # 记录一次删除操作
        log_data = {
            'table_name': 'tasks',
            'record_id': 'test-task-001',
            'operation_type': 'DELETE',
            'field_name': None,
            'old_value': '{"title": "旧任务", "status": "completed"}',
            'new_value': None,
            'operator_id': test_user['user_id'],
            'operator_name': test_user['name'],
            'operator_email': test_user['email']
        }
        
        log_id = log_audit(**log_data)
        assert log_id is not None, "应该返回日志ID"
        
        # 验证删除操作被记录
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT operation_type, old_value
                FROM dbo.data_audit_logs
                WHERE id = ?
            """, (log_id,))
            result = cursor.fetchone()
            
            assert result[0] == 'DELETE', "操作类型应该是 DELETE"
            assert result[1] is not None, "应该保存删除前的数据"
    
    def test_log_multiple_field_updates(self, test_user):
        """测试记录多字段更新（应生成多条日志）"""
        from audit import log_audit_batch
        
        # 更新多个字段
        updates = [
            {
                'table_name': 'employees',
                'record_id': 'test-emp-002',
                'operation_type': 'UPDATE',
                'field_name': 'name',
                'old_value': '张三',
                'new_value': '张三丰',
                'operator_id': test_user['user_id'],
                'operator_name': test_user['name'],
                'operator_email': test_user['email']
            },
            {
                'table_name': 'employees',
                'record_id': 'test-emp-002',
                'operation_type': 'UPDATE',
                'field_name': 'email',
                'old_value': 'zhang@old.com',
                'new_value': 'zhang@new.com',
                'operator_id': test_user['user_id'],
                'operator_name': test_user['name'],
                'operator_email': test_user['email']
            }
        ]
        
        log_ids = log_audit_batch(updates)
        assert len(log_ids) == 2, "应该返回2个日志ID"
        
        # 验证两条日志都已保存
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*)
                FROM dbo.data_audit_logs
                WHERE record_id = 'test-emp-002'
                    AND operation_type = 'UPDATE'
            """)
            count = cursor.fetchone()[0]
            assert count >= 2, "应该有2条字段更新日志"


class TestAuditLogQuery:
    """测试审计日志查询功能"""
    
    @pytest.fixture
    def sample_logs(self, test_user):
        """创建测试日志数据"""
        from audit import log_audit
        
        # 插入多条测试日志
        logs = []
        for i in range(5):
            log_id = log_audit(
                table_name='departments',
                record_id=f'dept-{i:03d}',
                operation_type='UPDATE' if i % 2 == 0 else 'INSERT',
                field_name='name' if i % 2 == 0 else None,
                old_value=f'旧部门{i}' if i % 2 == 0 else None,
                new_value=f'新部门{i}',
                operator_id=test_user['user_id'],
                operator_name=test_user['name'],
                operator_email=test_user['email']
            )
            logs.append(log_id)
        
        return logs
    
    def test_query_logs_by_table_name(self, sample_logs):
        """测试按表名查询审计日志"""
        from audit import query_audit_logs
        
        results = query_audit_logs(table_name='departments')
        assert len(results) >= 5, "应该至少返回5条日志"
        
        # 验证所有日志都属于 departments 表
        for log in results:
            assert log['table_name'] == 'departments'
    
    def test_query_logs_by_operator(self, sample_logs, test_user):
        """测试按操作人查询审计日志"""
        from audit import query_audit_logs
        
        results = query_audit_logs(operator_id=test_user['user_id'])
        assert len(results) >= 5, "应该至少返回5条日志"
        
        # 验证所有日志都属于该操作人
        for log in results:
            assert log['operator_id'] == test_user['user_id']
    
    def test_query_logs_by_operation_type(self, sample_logs):
        """测试按操作类型查询审计日志"""
        from audit import query_audit_logs
        
        results = query_audit_logs(operation_type='UPDATE')
        assert len(results) > 0, "应该有 UPDATE 操作日志"
        
        # 验证所有日志都是 UPDATE 类型
        for log in results:
            assert log['operation_type'] == 'UPDATE'
    
    def test_query_logs_by_date_range(self, sample_logs):
        """测试按时间范围查询审计日志"""
        from audit import query_audit_logs
        
        # 查询最近1小时的日志
        start_time = datetime.now() - timedelta(hours=1)
        end_time = datetime.now()
        
        results = query_audit_logs(start_time=start_time, end_time=end_time)
        assert len(results) >= 5, "应该返回最近的日志"
    
    def test_query_record_history(self, sample_logs):
        """测试查询特定记录的历史变更"""
        from audit import query_record_history
        
        # 查询特定记录的所有变更
        history = query_record_history(table_name='departments', record_id='dept-000')
        assert len(history) >= 1, "应该有至少1条历史记录"
        
        # 验证历史按时间倒序排列
        if len(history) > 1:
            for i in range(len(history) - 1):
                assert history[i]['operated_at'] >= history[i+1]['operated_at'], \
                    "历史记录应该按时间倒序"


class TestAuditLogAPI:
    """测试审计日志 API 端点"""
    
    def test_list_audit_logs_requires_admin(self):
        """测试查询审计日志需要管理员权限"""
        import requests
        from auth import create_access_token
        
        # 使用普通用户 token
        user_token = create_access_token({
            'user_id': 'test-user',
            'email': 'user@bosch.com',
            'name': '普通用户',
            'role': 'user'
        })
        
        headers = {'Authorization': f'Bearer {user_token}'}
        response = requests.get('http://localhost:8000/api/admin/audit-logs', headers=headers)
        
        assert response.status_code == 403, "普通用户应该被拒绝访问"
    
    def test_list_audit_logs_with_admin(self):
        """测试管理员可以查询审计日志"""
        import requests
        from auth import create_access_token
        
        # 使用管理员 token
        admin_token = create_access_token({
            'user_id': 'test-admin',
            'email': 'admin@bosch.com',
            'name': '管理员',
            'role': 'admin'
        })
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        response = requests.get('http://localhost:8000/api/admin/audit-logs', headers=headers)
        
        assert response.status_code == 200, "管理员应该可以访问"
        data = response.json()
        assert 'logs' in data, "响应应该包含 logs 字段"
        assert isinstance(data['logs'], list), "logs 应该是列表"
    
    def test_filter_audit_logs(self):
        """测试审计日志筛选功能"""
        import requests
        from auth import create_access_token
        
        admin_token = create_access_token({
            'user_id': 'test-admin',
            'email': 'admin@bosch.com',
            'name': '管理员',
            'role': 'admin'
        })
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        # 按表名筛选
        response = requests.get(
            'http://localhost:8000/api/admin/audit-logs',
            headers=headers,
            params={'table_name': 'departments'}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证返回的日志都属于指定表
        for log in data['logs']:
            assert log['table_name'] == 'departments'


if __name__ == '__main__':
    # 运行测试
    pytest.main([__file__, '-v', '--tb=short'])
