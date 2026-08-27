"""Add grievance_type column and cpgrams_officer role.

Revision ID: 20260828_0002
Revises: 20260825_0001
Create Date: 2026-08-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260828_0002"
down_revision: str | None = "20260825_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'role_name' AND e.enumlabel = 'cpgrams_officer'
            ) THEN
                ALTER TYPE role_name ADD VALUE 'cpgrams_officer';
            END IF;
        END$$;
        """
    )
    grievance_type = sa.Enum("cpgrams", "rights_violation", name="grievance_type")
    grievance_type.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "grievances",
        sa.Column("grievance_type", grievance_type, nullable=False, server_default="cpgrams"),
    )
    op.create_index("ix_grievances_grievance_type", "grievances", ["grievance_type"])


def downgrade() -> None:
    op.drop_index("ix_grievances_grievance_type", table_name="grievances")
    op.drop_column("grievances", "grievance_type")
    sa.Enum(name="grievance_type").drop(op.get_bind(), checkfirst=True)
