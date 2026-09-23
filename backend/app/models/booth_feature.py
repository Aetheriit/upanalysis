"""Materialized booth features used by the prediction pipeline."""
import uuid
from sqlalchemy import Column, DateTime, Float, Integer, JSON, String, Uuid
from datetime import datetime
from app.core.database import Base


class BoothFeatureVector(Base):
    __tablename__ = "booth_feature_vectors"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    constituency_code = Column(String(50), nullable=False)
    booth_key = Column(String(255), nullable=False)
    year = Column(Integer, nullable=False)
    features = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
