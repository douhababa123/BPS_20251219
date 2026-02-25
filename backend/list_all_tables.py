from database import db

with db.get_cursor() as cursor:
    cursor.execute("""
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'
        ORDER BY TABLE_NAME
    """)
    tables = [row[0] for row in cursor.fetchall()]
    
    print("All database tables:")
    print("-" * 50)
    for table in tables:
        print(table)
    
    # 已实现的表
    implemented = [
        'departments', 'employees', 'skills',  # Phase 3.1-3.3
        'factories', 'task_types', 'tasks',  # Phase 3.4.1-3.4.3
        'competency_definitions', 'competency_assessments',  # Phase 3.4.4-3.4.5
        'resource_task_types', 'resource_planning_tasks',  # Phase 3.4.6-3.4.7
        'schedule_change_notifications'  # Phase 3.4.8
    ]
    
    print("\n" + "=" * 50)
    print("Remaining tables to implement:")
    print("=" * 50)
    for table in tables:
        if table not in implemented and table not in ['users', 'otp_tokens', 'data_audit_logs']:
            print(f"  - {table}")
