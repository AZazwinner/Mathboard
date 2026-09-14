"""add token_version to users

Revision ID: d305da49fc54
Revises: f43e528ab149
Create Date: 2026-09-13 21:45:31.208849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



revision: str = 'd305da49fc54'
down_revision: Union[str, Sequence[str], None] = 'f43e528ab149'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""




    op.add_column('users', sa.Column('token_version', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'token_version')
