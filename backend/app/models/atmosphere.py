"""Optional evidence/atmosphere cache. Empty when no external API is configured."""
import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, JSON, String, Uuid
from app.core.database import Base


class AtmosphereCache(Base):
    __tablename__ = "atmosphere_cache"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    constituency_code = Column(String(50), nullable=False)
    constituency_name = Column(String(255), nullable=False)
    district = Column(String(255), nullable=True)
    sentiment_scores = Column(JSON, nullable=False, default=dict)
    dominant_issues = Column(JSON, nullable=False, default=list)
    major_events = Column(JSON, nullable=False, default=list)
    sources_count = Column(Integer, nullable=False, default=0)
    data_quality_score = Column(Float, nullable=False, default=0)
    scanned_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
