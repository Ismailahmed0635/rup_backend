import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from payment_gateway.models.base import Base
from payment_gateway.core.config import settings

# Database URL - PostgreSQL recommended for production, SQLite for development
SQLALCHEMY_DATABASE_URL = (
    os.getenv("DATABASE_URL", "sqlite:///./payment_gateway.db")
    if settings.ENVIRONMENT == "development"
    else os.getenv("DATABASE_URL", "postgresql://user:password@localhost/payment_gateway")
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {},
    echo=settings.DEBUG,  # Log SQL queries in debug mode
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)

def drop_tables():
    """Drop all database tables (for testing)"""
    Base.metadata.drop_all(bind=engine)

def get_correlation_id():
    """Get or generate a correlation ID for request tracking"""
    import uuid
    return str(uuid.uuid4())