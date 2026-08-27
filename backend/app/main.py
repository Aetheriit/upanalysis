"""
Election Intelligence Platform — FastAPI Backend
Enterprise-grade political analytics engine
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
import uvicorn

from app.core.config import settings
from app.core.database import Base, engine
from app import models  # noqa: F401 - register all ORM models with Base.metadata
from app.api.v1 import upload, projects, analytics, filters, maps, insights, reports, export, search


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    print("🚀 Election Intelligence Platform API starting...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database schema ready")
    yield
    # Shutdown
    print("🛑 Shutting down...")


app = FastAPI(
    title="Election Intelligence Platform",
    description="Enterprise-grade political analytics engine",
    version="1.0.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(upload.router, prefix="/api/v1/upload", tags=["Upload"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["Projects"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(filters.router, prefix="/api/v1/filters", tags=["Filters"])
app.include_router(maps.router, prefix="/api/v1/maps", tags=["Maps"])
app.include_router(insights.router, prefix="/api/v1/insights", tags=["AI Insights"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(export.router, prefix="/api/v1/export", tags=["Export"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "platform": "Election Intelligence Platform"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
