"""Booth model — individual polling booth within a constituency."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class Booth(Base):
    __tablename__ = "booths"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    constituency_id = Column(Uuid(as_uuid=True), ForeignKey("constituencies.id"), nullable=False)
    booth_number = Column(String(50), nullable=False)
    booth_name = Column(String(255), nullable=True)
    location = Column(String(500), nullable=True)
    total_electors = Column(Integer, default=0)
    male_electors = Column(Integer, default=0)
    female_electors = Column(Integer, default=0)
    third_gender_electors = Column(Integer, default=0)
    total_votes_polled = Column(Integer, default=0)
    male_votes = Column(Integer, default=0)
    female_votes = Column(Integer, default=0)
    turnout_pct = Column(Float, default=0.0)
    nota_votes = Column(Integer, default=0)
    rejected_votes = Column(Integer, default=0)
    valid_votes = Column(Integer, default=0)
    postal_votes = Column(Integer, default=0)
    winner_party = Column(String(255), nullable=True)
    runner_up_party = Column(String(255), nullable=True)
    winning_margin = Column(Integer, default=0)
    classification = Column(String(50), nullable=True)  # "strong", "weak", "swing"
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    constituency = relationship("Constituency", back_populates="booths")
    vote_records = relationship("VoteRecord", back_populates="booth", cascade="all, delete-orphan")


class VoteRecord(Base):
    """Individual vote record per candidate per booth."""
    __tablename__ = "vote_records"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booth_id = Column(Uuid(as_uuid=True), ForeignKey("booths.id"), nullable=False)
    candidate_id = Column(Uuid(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    votes = Column(Integer, default=0)
    vote_share_pct = Column(Float, default=0.0)

    # Relationships
    booth = relationship("Booth", back_populates="vote_records")
    candidate = relationship("Candidate", back_populates="vote_records")
