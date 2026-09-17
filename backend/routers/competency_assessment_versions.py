"""Administrator view of saved competency business versions."""

from fastapi import APIRouter, Depends, Query

from database import get_db

from .auth import verify_admin


router = APIRouter()


@router.get("")
def get_assessment_versions(
    limit: int = Query(100, ge=1, le=500),
    cursor=Depends(get_db),
    current_user: dict = Depends(verify_admin),
):
    del current_user
    cursor.execute(
        """
        SELECT TOP (?)
               v.id, v.created_at, v.cell_count, v.source, v.notes,
               v.created_by_user_id, u.email
        FROM dbo.competency_assessment_versions v
        LEFT JOIN dbo.users u ON u.id = v.created_by_user_id
        ORDER BY v.created_at DESC, v.id DESC
        """,
        limit,
    )
    return {
        "versions": [
            {
                "id": str(row[0]),
                "createdAt": row[1].isoformat() if row[1] else None,
                "cellCount": int(row[2]),
                "source": row[3],
                "notes": row[4],
                "createdByUserId": str(row[5]) if row[5] else None,
                "createdByEmail": row[6],
            }
            for row in cursor.fetchall()
        ]
    }
