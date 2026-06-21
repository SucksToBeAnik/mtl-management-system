from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional

from database import engine, Base, get_db
from models import TeamLead, Campaign
from schemas import (
    TeamLeadCreate, TeamLeadUpdate, TeamLeadResponse, TeamLeadDetailResponse,
    CampaignCreate, CampaignUpdate, CampaignResponse,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Marketing Team Lead Management")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/leads", response_model=list[TeamLeadResponse])
def list_leads(
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(TeamLead)
    if search:
        like = f"%{search}%"
        query = query.filter(
            TeamLead.name.ilike(like) | TeamLead.email.ilike(like)
        )
    if department:
        query = query.filter(TeamLead.department == department)
    return query.all()


@app.post("/api/leads", response_model=TeamLeadResponse, status_code=201)
def create_lead(lead: TeamLeadCreate, db: Session = Depends(get_db)):
    existing = db.query(TeamLead).filter(TeamLead.email == lead.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    db_lead = TeamLead(**lead.model_dump())
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead


@app.get("/api/leads/{lead_id}", response_model=TeamLeadDetailResponse)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(TeamLead).filter(TeamLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Team lead not found")
    return lead


@app.put("/api/leads/{lead_id}", response_model=TeamLeadResponse)
def update_lead(lead_id: int, lead: TeamLeadUpdate, db: Session = Depends(get_db)):
    db_lead = db.query(TeamLead).filter(TeamLead.id == lead_id).first()
    if not db_lead:
        raise HTTPException(status_code=404, detail="Team lead not found")

    update_data = lead.model_dump(exclude_unset=True)
    if "email" in update_data:
        existing = db.query(TeamLead).filter(
            TeamLead.email == update_data["email"],
            TeamLead.id != lead_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")

    for key, value in update_data.items():
        setattr(db_lead, key, value)
    db.commit()
    db.refresh(db_lead)
    return db_lead


@app.delete("/api/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    db_lead = db.query(TeamLead).filter(TeamLead.id == lead_id).first()
    if not db_lead:
        raise HTTPException(status_code=404, detail="Team lead not found")
    db.delete(db_lead)
    db.commit()
    return None


@app.get("/api/campaigns", response_model=list[CampaignResponse])
def list_campaigns(
    lead_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    campaign_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Campaign)
    if lead_id is not None:
        query = query.filter(Campaign.team_lead_id == lead_id)
    if status:
        query = query.filter(Campaign.status == status)
    if campaign_type:
        query = query.filter(Campaign.campaign_type == campaign_type)
    return query.all()


@app.post("/api/campaigns", response_model=CampaignResponse, status_code=201)
def create_campaign(campaign: CampaignCreate, db: Session = Depends(get_db)):
    lead = db.query(TeamLead).filter(TeamLead.id == campaign.team_lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Team lead not found")
    db_campaign = Campaign(**campaign.model_dump())
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign


@app.put("/api/campaigns/{campaign_id}", response_model=CampaignResponse)
def update_campaign(campaign_id: int, campaign: CampaignUpdate, db: Session = Depends(get_db)):
    db_campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not db_campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    update_data = campaign.model_dump(exclude_unset=True)
    if "team_lead_id" in update_data:
        lead = db.query(TeamLead).filter(TeamLead.id == update_data["team_lead_id"]).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Team lead not found")

    for key, value in update_data.items():
        setattr(db_campaign, key, value)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign


@app.get("/api/campaigns/{campaign_id}", response_model=CampaignResponse)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@app.delete("/api/campaigns/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    db_campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not db_campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(db_campaign)
    db.commit()
    return None


@app.get("/api/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    total_leads = db.query(TeamLead).count()
    total_campaigns = db.query(Campaign).count()
    active_campaigns = db.query(Campaign).filter(
        Campaign.status.in_(["Planning", "In Progress"])
    ).count()
    completed_campaigns = db.query(Campaign).filter(
        Campaign.status == "Completed"
    ).count()

    status_breakdown = {}
    for row in db.query(Campaign.status, Campaign.id).all():
        status_breakdown[row[0]] = status_breakdown.get(row[0], 0) + 1

    department_breakdown = {}
    for row in db.query(TeamLead.department, TeamLead.id).all():
        department_breakdown[row[0]] = department_breakdown.get(row[0], 0) + 1

    return {
        "total_leads": total_leads,
        "total_campaigns": total_campaigns,
        "active_campaigns": active_campaigns,
        "completed_campaigns": completed_campaigns,
        "status_breakdown": status_breakdown,
        "department_breakdown": department_breakdown,
    }


@app.get("/api/seed")
def seed_data(db: Session = Depends(get_db)):
    from datetime import date

    if db.query(TeamLead).count() > 0:
        return {"message": "Data already seeded"}

    leads = [
        TeamLead(name="Alice Johnson", email="alice@company.com", department="Social Media", phone="555-0101"),
        TeamLead(name="Bob Smith", email="bob@company.com", department="Email Marketing", phone="555-0102"),
        TeamLead(name="Carol Davis", email="carol@company.com", department="Content", phone="555-0103"),
    ]
    db.add_all(leads)
    db.commit()
    for l in leads:
        db.refresh(l)

    campaigns = [
        Campaign(name="Summer Sale Social", campaign_type="Social", channel="Instagram", status="In Progress", progress=45, start_date=date(2026, 1, 1), team_lead_id=leads[0].id),
        Campaign(name="Facebook Retargeting", campaign_type="Social", channel="Facebook", status="Planning", progress=10, start_date=date(2026, 2, 1), team_lead_id=leads[0].id),
        Campaign(name="Weekly Newsletter", campaign_type="Email", channel="Email", status="Completed", progress=100, start_date=date(2026, 1, 15), target_end_date=date(2026, 3, 1), team_lead_id=leads[1].id),
        Campaign(name="Product Launch Email", campaign_type="Email", channel="Email", status="In Progress", progress=70, start_date=date(2026, 3, 1), team_lead_id=leads[1].id),
        Campaign(name="Blog SEO Overhaul", campaign_type="SEO", channel="Organic", status="On Hold", progress=30, start_date=date(2026, 2, 15), team_lead_id=leads[2].id),
    ]
    db.add_all(campaigns)
    db.commit()

    return {"message": "Seed data created", "leads": len(leads), "campaigns": len(campaigns)}
