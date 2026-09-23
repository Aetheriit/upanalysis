"""Persisted prediction run and constituency output contracts."""
import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class PredictionRun(Base):
    __tablename__ = "prediction_runs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_year = Column(Integer, nullable=False, default=2027)
    status = Column(String(30), nullable=False, default="published")
    model_version = Column(String(100), nullable=False, default="ensemble-v1")
    feature_schema_version = Column(String(100), nullable=False, default="booth-features-v1")
    manifest = Column(JSON, nullable=False, default=dict)
    backtest = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="run", cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(Uuid(as_uuid=True), ForeignKey("prediction_runs.id"), nullable=False)
    constituency_id = Column(Uuid(as_uuid=True), ForeignKey("constituencies.id"), nullable=False)
    target_year = Column(Integer, nullable=False, default=2027)
    stat_predicted_party = Column(String(30), nullable=False)
    stat_confidence = Column(Float, nullable=False, default=0)
    stat_probabilities = Column(JSON, nullable=False, default=dict)
    stat_key_factors = Column(JSON, nullable=False, default=list)
    atmo_predicted_party = Column(String(30), nullable=True)
    atmo_confidence = Column(Float, nullable=True)
    atmo_sentiment_scores = Column(JSON, nullable=True)
    atmo_dominant_issues = Column(JSON, nullable=True)
    atmo_major_events = Column(JSON, nullable=True)
    atmo_sources_count = Column(Integer, nullable=False, default=0)
    final_predicted_party = Column(String(30), nullable=False)
    final_confidence = Column(Float, nullable=False, default=0)
    final_probabilities = Column(JSON, nullable=False, default=dict)
    final_confidence_label = Column(String(30), nullable=False, default="Toss-up")
    stat_weight_used = Column(Float, nullable=False, default=1)
    atmo_weight_used = Column(Float, nullable=False, default=0)
    is_flip = Column(Boolean, nullable=False, default=False)
    flip_from = Column(String(30), nullable=True)
    explanation = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("PredictionRun", back_populates="predictions")
    constituency = relationship("Constituency")
