"""UploadedFile model — tracks file uploads and processing status."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(Uuid(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)  # "csv", "excel", "json"
    file_size = Column(Integer, default=0)
    status = Column(String(50), default="uploaded")  # "uploaded", "processing", "validated", "imported", "error"
    rows_count = Column(Integer, default=0)
    columns_count = Column(Integer, default=0)
    detected_schema = Column(JSON, nullable=True)  # Auto-detected column mapping
    validation_report = Column(JSON, nullable=True)  # Validation results
    error_message = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="uploaded_files")
