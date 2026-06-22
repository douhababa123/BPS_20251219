"""Sync dbo.employees into dbo.users and generate initial passwords."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

from account_management import sync_employee_accounts, write_generated_passwords_csv
from database import db


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync employee accounts into users.")
    parser.add_argument("--apply", action="store_true", help="Commit changes. Without this, roll back.")
    parser.add_argument(
        "--output",
        default=None,
        help="CSV path for generated temporary passwords.",
    )
    args = parser.parse_args()

    connection = db.connect()
    cursor = connection.cursor()
    try:
        result = sync_employee_accounts(cursor)
        if args.apply:
            connection.commit()
        else:
            connection.rollback()

        print("employees_seen:", result["employees_seen"])
        print("created:", result["created"])
        print("updated:", result["updated"])
        print("bound:", result["bound"])
        print("skipped_without_email:", result["skipped_without_email"])
        print("generated_passwords:", len(result["passwords"]))

        if args.apply and result["passwords"]:
            output = args.output
            if not output:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output = f"exports/employee_account_initial_passwords_{timestamp}.csv"
            path = Path(output)
            write_generated_passwords_csv(path, result["passwords"])
            print("password_file:", path)
        elif not args.apply:
            print("dry_run: changes rolled back")

        return 0
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
