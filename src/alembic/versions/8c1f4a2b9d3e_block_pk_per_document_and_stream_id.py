"""block primary key per document, and ydoc stream position

Revision ID: 8c1f4a2b9d3e
Revises: d305da49fc54
Create Date: 2026-09-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8c1f4a2b9d3e'
down_revision: Union[str, Sequence[str], None] = 'd305da49fc54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    is_postgres = op.get_bind().dialect.name == "postgresql"

    if is_postgres:
        op.drop_constraint('document_blocks_pkey', 'document_blocks', type_='primary')
        op.create_primary_key('document_blocks_pkey', 'document_blocks', ['doc_id', 'id'])
    else:
        with op.batch_alter_table('document_blocks') as batch_op:
            batch_op.create_primary_key('document_blocks_pkey', ['doc_id', 'id'])

    op.add_column('document_ydocs', sa.Column('stream_id', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('document_ydocs', 'stream_id')

    is_postgres = op.get_bind().dialect.name == "postgresql"

    if is_postgres:
        op.drop_constraint('document_blocks_pkey', 'document_blocks', type_='primary')
        op.create_primary_key('document_blocks_pkey', 'document_blocks', ['id'])
    else:
        with op.batch_alter_table('document_blocks') as batch_op:
            batch_op.create_primary_key('document_blocks_pkey', ['id'])
