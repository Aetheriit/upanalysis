"""Election model — represents a specific election event."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class Election(Base):
    __tablename__ = "elections"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(Uuid(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    year = Column(Integer, nullable=False)
    election_type = Column(String(100), nullable=False)  # "assembly", "parliament", "local"
    state = Column(String(255), nullable=True)
    country = Column(String(100), default="India")
    phase = Column(Integer, nullable=True)
    date = Column(DateTime, nullable=True)
    total_constituencies = Column(Integer, default=0)
    total_booths = Column(Integer, default=0)
    total_voters = Column(Integer, default=0)
    total_votes_polled = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="elections")
    constituencies = relationship("Constituency", back_populates="election", cascade="all, delete-orphan")
    candidates = relationship("Candidate", back_populates="election", cascade="all, delete-orphan")
