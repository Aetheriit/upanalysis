"""Project model — top-level container for election analysis."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    elections = relationship("Election", back_populates="project", cascade="all, delete-orphan")
    uploaded_files = relationship("UploadedFile", back_populates="project", cascade="all, delete-orphan")
