"""GIS map data endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/geojson")
async def get_geojson(level: str = "state"):
    """Get GeoJSON boundaries for map rendering."""
    return {"type": "FeatureCollection", "features": [], "level": level}


@router.get("/heatmap")
async def get_heatmap_data(metric: str = "turnout"):
    """Get heatmap data for map overlay."""
    return {"metric": metric, "data": []}
