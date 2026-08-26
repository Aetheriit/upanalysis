"""Project management endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_projects():
    """List all projects."""
    # Mock data for now
    return {
        "projects": [
            {
                "id": "demo-project-1",
                "name": "Uttar Pradesh Assembly 2024",
                "description": "Complete analysis of Uttar Pradesh assembly elections",
                "status": "active",
                "elections": 2,
                "constituencies": 403,
                "created_at": "2024-11-20T10:00:00Z",
            }
        ]
    }


@router.post("/")
async def create_project(name: str, description: str = ""):
    """Create a new project."""
    return {
        "id": "new-project-id",
        "name": name,
        "description": description,
        "status": "active",
    }
