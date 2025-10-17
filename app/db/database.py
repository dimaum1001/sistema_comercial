from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

Base = declarative_base()

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def ensure_schema_integrity() -> None:
    """Ensure essential columns exist when running without migrations."""
    migrations = (
        (
            "clientes",
            "base_legal_tratamento",
            "ALTER TABLE clientes ADD COLUMN base_legal_tratamento VARCHAR(30) NOT NULL DEFAULT 'execucao_contrato'",
        ),
        (
            "clientes",
            "consentimento_registrado_em",
            "ALTER TABLE clientes ADD COLUMN consentimento_registrado_em TIMESTAMP NULL",
        ),
        (
            "fornecedores",
            "base_legal_tratamento",
            "ALTER TABLE fornecedores ADD COLUMN base_legal_tratamento VARCHAR(30) NOT NULL DEFAULT 'execucao_contrato'",
        ),
        (
            "fornecedores",
            "consentimento_registrado_em",
            "ALTER TABLE fornecedores ADD COLUMN consentimento_registrado_em TIMESTAMP NULL",
        ),
    )

    with engine.begin() as conn:
        inspector = inspect(conn)
        table_columns = {}
        existing_tables = set(inspector.get_table_names())

        for table, _, _ in migrations:
            if table not in table_columns:
                table_columns[table] = {col["name"] for col in inspector.get_columns(table)}

        for table, column, ddl in migrations:
            columns = table_columns.setdefault(table, set())
            if column not in columns:
                conn.execute(text(ddl))
                columns.add(column)
                print(f"[db] Added missing column {table}.{column}")

        if "password_reset_tokens" not in existing_tables:
            from app.models.models import PasswordResetToken

            PasswordResetToken.__table__.create(bind=conn, checkfirst=True)
            print("[db] Created missing table password_reset_tokens")
            existing_tables.add("password_reset_tokens")

        if "direitos_titulares" not in existing_tables:
            from app.models.models import DataSubjectRequest

            DataSubjectRequest.__table__.create(bind=conn, checkfirst=True)
            existing_tables.add("direitos_titulares")
            print("[db] Created missing table direitos_titulares")

        if "direitos_titulares_eventos" not in existing_tables:
            from app.models.models import DataSubjectRequestEvent

            DataSubjectRequestEvent.__table__.create(bind=conn, checkfirst=True)
            existing_tables.add("direitos_titulares_eventos")
            print("[db] Created missing table direitos_titulares_eventos")

        if "dpo_contatos" not in existing_tables:
            from app.models.models import DpoContactMessage

            DpoContactMessage.__table__.create(bind=conn, checkfirst=True)
            existing_tables.add("dpo_contatos")
            print("[db] Created missing table dpo_contatos")
        else:
            columns = table_columns.get("dpo_contatos")
            if columns is None:
                columns = {col["name"] for col in inspector.get_columns("dpo_contatos")}
                table_columns["dpo_contatos"] = columns
            if "resposta" not in columns:
                conn.execute(text("ALTER TABLE dpo_contatos ADD COLUMN resposta TEXT NULL"))
                columns.add("resposta")
                print("[db] Added missing column dpo_contatos.resposta")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
