"""
Payment Gateway Application - bKash, Nagad, and Bank Integrations
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv

from payment_gateway.core.config import settings
from payment_gateway.core.database import get_db, create_tables
from payment_gateway.api.v1 import payment as payment_v1

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Global correlation ID tracking
correlation_ids = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """ lifespan context manager for startup/shutdown """
    # Startup
    if settings.ENVIRONMENT == "development":
        create_tables()
    logger.info(f"Starting Payment Gateway in {settings.ENVIRONMENT} mode")
    yield
    # Shutdown
    logger.info("Payment Gateway shutting down")


# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Bangladesh Payment Gateway - bKash, Nagad, and Bank payments",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add session middleware for better session handling
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY or "change-this-in-production",
)

# Include API routes
app.include_router(payment_v1.router, prefix=settings.API_V1_STR, tags=["payment"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Bangladesh Payment Gateway API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "documentation": "/docs",
        "endpoints": {
            "initiate": f"{settings.API_V1_STR}/payment/initiate",
            "callback": f"{settings.API_V1_STR}/payment/callback",
            "status": f"{settings.API_V1_STR}/payment/status/{{order_id}}",
            "methods": f"{settings.API_V1_STR}/payment/methods",
            "bank_verify": f"{settings.API_V1_STR}/payment/bank/verify",
        }
    }


@app.get("/health", status_code=200)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "payment-gateway",
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "payment_gateway.app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        access_log=False,
    )