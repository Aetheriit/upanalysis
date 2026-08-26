"""Export endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/chart")
async def export_chart(chart_id: str, format: str = "png"):
    """Export a chart as PNG/SVG."""
    return {"status": "generating", "format": format}


@router.get("/data")
async def export_data(format: str = "csv"):
    """Export filtered data as CSV/Excel/JSON."""
    return {"status": "generating", "format": format}
