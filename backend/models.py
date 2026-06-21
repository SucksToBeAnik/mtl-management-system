from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    ForeignKey, Date, DateTime, Float
)
from sqlalchemy.orm import relationship
from datetime import datetime, date

from database import Base


class TeamLead(Base):
    __tablename__ = "team_leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    phone = Column(String(20), nullable=True)
    department = Column(String(50), nullable=False, default="General")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaigns = relationship("Campaign", back_populates="team_lead", cascade="all, delete-orphan")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    campaign_type = Column(String(50), nullable=False)
    channel = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="Planning")
    progress = Column(Integer, default=0)
    start_date = Column(Date, default=date.today)
    target_end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    team_lead_id = Column(Integer, ForeignKey("team_leads.id", ondelete="CASCADE"), nullable=False)
    team_lead = relationship("TeamLead", back_populates="campaigns")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(20), nullable=False)
    entity_type = Column(String(20), nullable=False)
    entity_id = Column(Integer, nullable=False)
    entity_name = Column(String(200), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
