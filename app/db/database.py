from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings  # OK: importar apenas config
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# Função centralizada para injeção de dependência no FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()