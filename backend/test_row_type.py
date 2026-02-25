from database import db

with db.get_cursor() as cursor:
    cursor.execute('SELECT TOP 1 * FROM resource_planning_tasks')
    row = cursor.fetchone()
    if row:
        print(f"Type: {type(row)}")
        print(f"Has items: {hasattr(row, 'items')}")
        try:
            d = dict(row)
            print(f"dict() works: {len(d)} keys")
        except Exception as e:
            print(f"dict() failed: {e}")
        
        # Try different approaches
        print("\nTrying zip approach:")
        try:
            columns = [column[0] for column in cursor.description]
            d2 = dict(zip(columns, row))
            print(f"zip works: {len(d2)} keys")
        except Exception as e:
            print(f"zip failed: {e}")
