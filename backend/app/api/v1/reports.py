"""Report generation endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.post("/generate")
async def generate_report(report_type: str = "pdf"):
    """Generate a report (PDF, PPTX, Excel, Word)."""
    return {
        "status": "generating",
        "report_type": report_type,
        "message": f"Generating {report_type.upper()} report...",
    }


@router.get("/templates")
async def list_report_templates():
    """List available report templates."""
    return {
        "templates": [
            {"id": "exec-summary", "name": "Executive Summary", "formats": ["pdf", "pptx"]},
            {"id": "full-analysis", "name": "Full Analysis Report", "formats": ["pdf", "docx"]},
            {"id": "booth-report", "name": "Booth-Level Report", "formats": ["pdf", "xlsx"]},
            {"id": "constituency-brief", "name": "Constituency Briefing", "formats": ["pdf", "pptx"]},
        ]
    }
