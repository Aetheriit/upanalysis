"""Party and Alliance models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Alliance(Base):
    __tablename__ = "alliances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    abbreviation = Column(String(50), nullable=True)
    color = Column(String(7), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    parties = relationship("Party", back_populates="alliance")


class Party(Base):
    __tablename__ = "parties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    abbreviation = Column(String(50), nullable=True)
    color = Column(String(7), nullable=True)  # hex color
    symbol = Column(String(255), nullable=True)
    party_type = Column(String(50), nullable=True)  # "national", "state", "regional"
    alliance_id = Column(UUID(as_uuid=True), ForeignKey("alliances.id"), nullable=True)
    logo_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    alliance = relationship("Alliance", back_populates="parties")
    candidates = relationship("Candidate", back_populates="party")
