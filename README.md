# Marketing Team Lead Management System

A lightweight internal dashboard for managing marketing team leads, their assigned campaigns, and work progress. Built as a monorepo with a FastAPI backend and a vanilla JS single-page frontend.

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12) |
| **ORM** | [SQLAlchemy](https://www.sqlalchemy.org/) (sync) |
| **Database** | SQLite (local) / PostgreSQL (production on Render) |
| **Validation** | [Pydantic v2](https://docs.pydantic.dev/) |
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **Hosting** | Render (backend API) + Vercel (frontend) |

## Features

- **Team Lead Management** — Add, view, edit, and delete marketing team leads
- **Campaign Management** — Assign campaigns to leads with type, channel, status, and progress tracking
- **Expandable Dashboard** — Click a lead row to expand and see their campaigns inline
- **Summary Cards** — At-a-glance stats: total leads, active campaigns, completed work, department count
- **Search & Filters** — Search leads by name/email, filter by department; filter campaigns by status and type
- **Validation** — Required fields, email uniqueness, progress range (0-100)
- **Sample Data** — One-click seed button to load demo data

## Project Structure

```
marketing-lead-manager/
├── backend/
│   ├── main.py          # FastAPI app — API route definitions
│   ├── models.py        # SQLAlchemy models (TeamLead, Campaign)
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── database.py      # SQLite connection and session
│   ├── requirements.txt # Python dependencies
│   └── Procfile         # Render deployment config
├── frontend/
│   ├── index.html       # Single-page dashboard UI
│   ├── style.css        # Styling
│   └── script.js        # API communication and UI logic
├── .gitignore
├── runtime.txt          # Python version for Render
└── start.sh             # Local dev startup script
```

## Run Locally

### Prerequisites
- Python 3.12+
- pip

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000`. Interactive docs at `http://127.0.0.1:8000/docs`.

### Frontend

Simply open `frontend/index.html` in your browser.

### Load Sample Data

Once the backend is running, click the **"Load Sample Data"** button on the dashboard or visit `http://127.0.0.1:8000/api/seed`.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/leads` | List leads (optional `?search=` and `?department=`) |
| `POST` | `/api/leads` | Create a team lead |
| `GET` | `/api/leads/{id}` | Get lead details with campaigns |
| `PUT` | `/api/leads/{id}` | Update a team lead |
| `DELETE` | `/api/leads/{id}` | Delete a team lead |
| `GET` | `/api/campaigns` | List campaigns (optional `?lead_id=`, `?status=`, `?campaign_type=`) |
| `POST` | `/api/campaigns` | Create a campaign |
| `GET` | `/api/campaigns/{id}` | Get campaign details |
| `PUT` | `/api/campaigns/{id}` | Update a campaign |
| `DELETE` | `/api/campaigns/{id}` | Delete a campaign |
| `GET` | `/api/dashboard/summary` | Dashboard statistics |
| `GET` | `/api/seed` | Load sample data |

## Deployment

### Backend (Render)

The backend is deployed at **https://mtl-management-system.onrender.com**.

To deploy your own instance:
1. Fork this repo on GitHub
2. Go to [Render Dashboard](https://dashboard.render.com) → New → Web Service
3. Connect your GitHub repo
4. Set:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Deploy

### Frontend (Vercel)

The frontend is already configured to point at the Render backend. To deploy on Vercel:
1. Go to [Vercel Dashboard](https://vercel.com) → Add New → Project
2. Import your GitHub repo
3. Set:
   - **Root Directory**: `frontend`
   - **Build Command**: leave blank (static files)
   - **Output Directory**: `.` (root of frontend folder)
4. Deploy
