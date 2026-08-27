"""Constituency model — electoral constituency with geographic data."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class Constituency(Base):
    __tablename__ = "constituencies"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    election_id = Column(Uuid(as_uuid=True), ForeignKey("elections.id"), nullable=False)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    constituency_type = Column(String(50), default="assembly")  # "assembly", "parliament"
    state = Column(String(255), nullable=True)
    district = Column(String(255), nullable=True)
    region = Column(String(255), nullable=True)
    is_urban = Column(String(50), nullable=True)  # "urban", "rural", "semi-urban"
    total_electors = Column(Integer, default=0)
    total_votes_polled = Column(Integer, default=0)
    turnout_pct = Column(Float, default=0.0)
    nota_votes = Column(Integer, default=0)
    rejected_votes = Column(Integer, default=0)
    valid_votes = Column(Integer, default=0)
    winner_name = Column(String(255), nullable=True)
    winner_party = Column(String(255), nullable=True)
    winning_margin = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    election = relationship("Election", back_populates="constituencies")
    booths = relationship("Booth", back_populates="constituency", cascade="all, delete-orphan")
    candidates = relationship("Candidate", back_populates="constituency")
    demographics = relationship("Demographic", back_populates="constituency", cascade="all, delete-orphan")
