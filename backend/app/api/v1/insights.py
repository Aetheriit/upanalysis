"""AI insights endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/summary")
async def get_ai_summary():
    """Get AI-generated election summary."""
    return {
        "insights": [
            {
                "type": "key_finding",
                "title": "BJP Strengthens Urban Hold",
                "description": "BJP's vote share in urban constituencies increased by 4.2% compared to 2019, driven by strong performance in Mumbai and Pune districts.",
                "severity": "high",
                "icon": "trending-up",
            },
            {
                "type": "anomaly",
                "title": "Unusual Turnout Spike in Nagpur",
                "description": "Nagpur district recorded 78.3% turnout, significantly higher than the state average of 61.4%. This correlates with aggressive ground mobilization efforts.",
                "severity": "medium",
                "icon": "alert-triangle",
            },
            {
                "type": "trend",
                "title": "NOTA Votes Rising Steadily",
                "description": "NOTA votes have increased by 0.3% every election since 2014, indicating growing voter disillusionment with available candidates.",
                "severity": "low",
                "icon": "info",
            },
            {
                "type": "opportunity",
                "title": "INC Recovery in Rural Belts",
                "description": "INC showed a 2.8% swing recovery in rural constituencies, suggesting potential gains if rural outreach is intensified.",
                "severity": "medium",
                "icon": "target",
            },
            {
                "type": "threat",
                "title": "Alliance Fragmentation Risk",
                "description": "NCP's vote share decline of 1.5% in alliance seats suggests potential seat-sharing conflicts in upcoming elections.",
                "severity": "high",
                "icon": "alert-circle",
            },
        ]
    }


@router.post("/chat")
async def chat_with_ai(query: str):
    """Chat with AI about election data."""
    return {
        "query": query,
        "response": f"Based on the available election data, here's my analysis regarding '{query}': The data shows significant patterns that would require further investigation. Please upload your election datasets for detailed AI-powered analysis.",
        "sources": [],
    }
