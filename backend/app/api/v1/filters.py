"""Filter options endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/options")
async def get_filter_options():
    """Get all available filter options."""
    return {
        "years": [2024, 2019, 2014, 2009, 2004],
        "states": ["Maharashtra", "Gujarat", "Rajasthan", "Madhya Pradesh", "Karnataka", "Uttar Pradesh"],
        "districts": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Thane", "Solapur", "Kolhapur"],
        "election_types": ["Assembly", "Parliament", "Local Body"],
        "parties": [
            {"name": "BJP", "abbreviation": "BJP", "color": "#FF6B00"},
            {"name": "INC", "abbreviation": "INC", "color": "#00BCD4"},
            {"name": "NCP", "abbreviation": "NCP", "color": "#4CAF50"},
            {"name": "Shiv Sena", "abbreviation": "SHS", "color": "#FF5722"},
            {"name": "MNS", "abbreviation": "MNS", "color": "#FFC107"},
            {"name": "BSP", "abbreviation": "BSP", "color": "#2196F3"},
            {"name": "AIMIM", "abbreviation": "AIMIM", "color": "#009688"},
        ],
        "categories": ["Gender", "Age", "Religion", "Caste", "Education", "Income", "Urban/Rural"],
    }
