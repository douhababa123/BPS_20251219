import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=10.88.43.154;DATABASE=DCCT_BPS_Debug;UID=TEST;PWD=123456'
)
cursor = conn.cursor()

# 找出所有异常技能
sql = (
    "SELECT s.id, s.module_id, s.module_name, s.skill_name, "
    "CAST(s.created_at AS NVARCHAR) AS created_at, "
    "COUNT(ca.id) AS assessment_count "
    "FROM skills s "
    "LEFT JOIN competency_assessments ca ON s.id = ca.skill_id "
    "WHERE s.module_id = 99 "
    "   OR (s.module_id = 1 AND s.module_name <> 'BPS elements') "
    "   OR (s.module_id = 2 AND s.module_name <> 'Investment efficiency_PGL') "
    "GROUP BY s.id, s.module_id, s.module_name, s.skill_name, s.created_at "
    "ORDER BY s.module_id, s.created_at"
)
cursor.execute(sql)
rows = cursor.fetchall()

print("=== 异常技能（测试数据）详情 ===")
test_ids = []
for r in rows:
    print(
        f"  id={r.id:4d} | module_id={r.module_id:3d} | module_name={str(r.module_name):25s}"
        f" | skill={str(r.skill_name):30s} | assessments={r.assessment_count}"
    )
    test_ids.append(r.id)

print(f"\n共 {len(rows)} 条异常技能，id 列表: {test_ids}")

if test_ids:
    # 检查是否有关联评估
    ids_str = ",".join(str(i) for i in test_ids)
    cursor.execute(
        "SELECT COUNT(*) FROM competency_assessments WHERE skill_id IN (" + ids_str + ")"
    )
    cnt = cursor.fetchone()[0]
    print(f"\n关联评估记录数: {cnt}")

    if cnt == 0:
        print("\n✅ 无关联评估，可以安全删除！")
        confirm = input("确认删除这些测试技能？(yes/no): ").strip().lower()
        if confirm == "yes":
            cursor.execute("DELETE FROM skills WHERE id IN (" + ids_str + ")")
            conn.commit()
            print(f"✅ 已删除 {cursor.rowcount} 条测试技能！")

            # 验证
            cursor.execute(
                "SELECT module_id, module_name, COUNT(*) AS cnt "
                "FROM skills GROUP BY module_id, module_name ORDER BY module_id"
            )
            print("\n=== 清理后的模块列表 ===")
            for row in cursor.fetchall():
                print(f"  module_id={row.module_id:3d} | {str(row.module_name):30s} | {row.cnt} 技能")
        else:
            print("已取消删除。")
    else:
        print(f"\n⚠️ 有 {cnt} 条评估数据关联了这些技能，请先处理！")
        cursor.execute(
            "SELECT skill_id, COUNT(*) AS cnt FROM competency_assessments "
            "WHERE skill_id IN (" + ids_str + ") GROUP BY skill_id"
        )
        for row in cursor.fetchall():
            print(f"  skill_id={row.skill_id}: {row.cnt} 条评估")

conn.close()
