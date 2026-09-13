import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    # Server settings
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # CORS
    BACKEND_CORS_ORIGINS: list = os.getenv(
        "BACKEND_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    
    # Payment gateway settings
    # bKash
    BKASH_BASE_URL: str = os.getenv("BKASH_BASE_URL", "https://sandbox.bkash.com")
    BKASH_USERNAME: str = os.getenv("BKASH_USERNAME", "")
    BKASH_PASSWORD: str = os.getenv("BKASH_PASSWORD", "")
    BKASH_APP_KEY: str = os.getenv("BKASH_APP_KEY", "")
    BKASH_APP_SECRET: str = os.getenv("BKASH_APP_SECRET", "")
    
    # Nagad
    NAGAD_BASE_URL: str = os.getenv("NAGAD_BASE_URL", "https://sandbox.nagad.com/api")
    NAGAD_MERCHANT_ID: str = os.getenv("NAGAD_MERCHANT_ID", "")
    NAGAD_PUBLIC_KEY: str = os.getenv("NAGAD_PUBLIC_KEY", "")
    NAGAD_PRIVATE_KEY: str = os.getenv("NAGAD_PRIVATE_KEY", "")
    
    # Bank payments
    BANK_VERIFICATION_ENABLED: bool = os.getenv("BANK_VERIFICATION_ENABLED", "true").lower() == "true"
    BANK_ALLOWED_LIST: list = os.getenv(
        "BANK_ALLOWED_LIST", "DBBL,Brac,CityBank,IslamiBank,Standard Chartered"
    ).split(",")
    
    # API settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Bangladesh Payment Gateway"

settings = Settings()