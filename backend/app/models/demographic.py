"""Demographic model — population demographics for a constituency."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Demographic(Base):
    __tablename__ = "demographics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    constituency_id = Column(UUID(as_uuid=True), ForeignKey("constituencies.id"), nullable=False)
    category = Column(String(100), nullable=False)  # "caste", "religion", "age", "gender", "education", "income"
    subcategory = Column(String(255), nullable=False)  # "Hindu", "Muslim", "SC", "ST", "OBC", "18-25", "Male"
    population = Column(Integer, default=0)
    population_pct = Column(Float, default=0.0)
    estimated_voters = Column(Integer, default=0)
    estimated_turnout_pct = Column(Float, default=0.0)
    estimated_vote_pct = Column(Float, default=0.0)
    support_pct = Column(Float, default=0.0)
    opposition_pct = Column(Float, default=0.0)
    swing_pct = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    constituency = relationship("Constituency", back_populates="demographics")
