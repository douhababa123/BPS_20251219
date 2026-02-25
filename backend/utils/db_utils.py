"""
Helper function to convert pyodbc.Row to dict
"""

def row_to_dict(cursor, row):
    """Convert a pyodbc.Row to dictionary using cursor.description"""
    if row is None:
        return None
    columns = [column[0] for column in cursor.description]
    return dict(zip(columns, row))


def rows_to_list(cursor, rows):
    """Convert a list of pyodbc.Row objects to list of dictionaries"""
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in rows]
