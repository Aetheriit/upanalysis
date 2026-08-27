"""Application configuration using Pydantic Settings."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    APP_NAME: str = "Election Intelligence Platform"
    DEBUG: bool = True
    SECRET_KEY: str = "election-intel-secret-key-change-in-production"
    
    # Database (defaults to SQLite for zero-config deployment)
    DATABASE_URL: str = "sqlite+aiosqlite:///./election_data.db"
    DATABASE_SYNC_URL: str = "sqlite:///./election_data.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # File Upload
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500MB
    UPLOAD_DIR: str = "./uploads"
    
    # AI
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    AI_PROVIDER: str = "mock"  # "openai", "gemini", "mock"
    
    # JWT
    JWT_SECRET: str = "jwt-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24  # 24 hours
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
