from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import date, datetime


class CampaignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    campaign_type: str = Field(..., min_length=1, max_length=50)
    channel: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    status: str = Field(default="Planning")
    progress: int = Field(default=0, ge=0, le=100)
    start_date: date = Field(default_factory=date.today)
    target_end_date: Optional[date] = None


class CampaignCreate(CampaignBase):
    team_lead_id: int


class CampaignUpdate(CampaignBase):
    name: Optional[str] = None
    campaign_type: Optional[str] = None
    channel: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    start_date: Optional[date] = None
    target_end_date: Optional[date] = None
    team_lead_id: Optional[int] = None


class CampaignResponse(CampaignBase):
    id: int
    team_lead_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TeamLeadBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = None
    department: str = Field(default="General", max_length=50)
    is_active: bool = True


class TeamLeadCreate(TeamLeadBase):
    pass


class TeamLeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


class TeamLeadResponse(TeamLeadBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TeamLeadDetailResponse(TeamLeadResponse):
    campaigns: list[CampaignResponse] = []


class ActivityLogResponse(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int
    entity_name: str
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
