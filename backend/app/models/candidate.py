"""Candidate model — election contestant with full profile."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, BigInteger, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    election_id = Column(Uuid(as_uuid=True), ForeignKey("elections.id"), nullable=False)
    constituency_id = Column(Uuid(as_uuid=True), ForeignKey("constituencies.id"), nullable=True)
    party_id = Column(Uuid(as_uuid=True), ForeignKey("parties.id"), nullable=True)
    name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    education = Column(String(255), nullable=True)
    profession = Column(String(255), nullable=True)
    criminal_cases = Column(Integer, default=0)
    assets = Column(BigInteger, default=0)
    liabilities = Column(BigInteger, default=0)
    photo_url = Column(String(500), nullable=True)
    votes_received = Column(Integer, default=0)
    vote_share_pct = Column(Float, default=0.0)
    margin = Column(Integer, default=0)
    is_winner = Column(Boolean, default=False)
    position = Column(Integer, nullable=True)  # 1st, 2nd, 3rd...
    deposit_lost = Column(Boolean, default=False)
    is_incumbent = Column(Boolean, default=False)
    previous_elections = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    election = relationship("Election", back_populates="candidates")
    constituency = relationship("Constituency", back_populates="candidates")
    party = relationship("Party", back_populates="candidates")
    vote_records = relationship("VoteRecord", back_populates="candidate")
