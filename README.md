# WattSight

WattSight is a full-stack wind forecasting and analytics dashboard designed to compare actual wind generation against forecasted values using BMRS data. The application combines a Next.js frontend with a FastAPI backend to provide operational insight, forecast error analysis, delivery-period matching, and downloadable reporting.

## Project Purpose

The platform helps users understand:
- how wind output compares with forecasted generation
- how accurate the forecast is over a selected date
- which delivery period is next
- how forecast bias, error, and accuracy behave over time
- how to review and export analysis in a professional format

## Architecture

The application follows a simple two-tier architecture:

```text
User Browser
   ↓
Next.js Frontend (React + TypeScript)
   ↓
FastAPI Backend (Python)
   ↓
BMRS / External Data Provider
   ↓
Analytics + Forecast Matching + Reporting
```

### Frontend
- Built with Next.js and TypeScript
- Renders the dashboard, charts, summary cards, and tables
- Allows date-based filtering and metric exploration
- Calls backend endpoints for live forecast and actual generation data
- Exports a PDF report for selected performance data

### Backend
- Built with Python and FastAPI
- Handles data retrieval and analytics processing
- Matches actual generation records to the most recent valid forecast before each delivery time
- Exposes endpoints for data access and analysis

## Directory Structure

```text
WattSight/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── services/
│   │       └── analytics_service.py
│   ├── Dockerfile
│   └── requirements.txt
├── components/
│   ├── ui/
│   │   └── button.tsx
│   └── wattsight-dashboard.tsx
├── lib/
│   ├── utils.ts
│   └── wind-api.ts
├── public/
├── .env
├── components.json
├── docker-compose.yml
├── next.config.mjs
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
├── tsconfig.json
├── README.md
└── ...
```

### File and Directory Details

- `app/` — frontend application entry files and global styling
- `app/page.tsx` — main landing page for the dashboard
- `app/layout.tsx` — application shell and top-level layout
- `app/globals.css` — all styling for the dashboard and page layout
- `components/` — reusable frontend UI and dashboard logic
- `components/wattsight-dashboard.tsx` — main dashboard implementation, metrics, charts, and reporting
- `components/ui/` — UI primitives such as button components
- `lib/` — helper functions and API client logic
- `lib/wind-api.ts` — requests to the backend for actual and forecast data
- `backend/` — Python backend service and dependencies
- `backend/app/main.py` — FastAPI startup and route registration
- `backend/app/services/analytics_service.py` — forecast matching and analytics computations
- `backend/requirements.txt` — backend Python dependencies
- `public/` — static frontend assets
- `docker-compose.yml` — containerized service orchestration
- `package.json` — frontend scripts and dependencies
- `tsconfig.json` — TypeScript configuration
- `.env` — runtime local environment variables

## Prerequisites

Before running the application make sure you have:
- Node.js installed
- npm or pnpm installed
- Python 3.10+ installed
- required environment values configured for the backend and frontend

## How to Start the Application

### 1. Install frontend dependencies

```bash
npm install
```

If using pnpm instead:

```bash
pnpm install
```

### 2. Install backend dependencies

```bash
cd backend
python -m venv .venv
```

On Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Then install the backend requirements:

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create the required `.env` files and set the necessary values. The frontend typically uses values such as:

```env
WATTSIGHT_BACKEND_URL=http://127.0.0.1:8000
```

The backend may also require BMRS or service-specific configuration values depending on deployment.

### 4. Start the backend

From the project root:

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Start the frontend

From the project root:

```bash
npm run dev
```

The frontend should run locally at:

```text
http://localhost:3000
```

The FastAPI API documentation is available at:

```text
http://localhost:8000/docs
```

## Application Flow

1. User selects a delivery date in the dashboard.
2. The frontend requests actual generation data from the backend.
3. The backend fetches forecast and generation records and applies validation logic.
4. Forecast values are matched to relevant delivery periods based on publish timing.
5. Summary metrics, error calculations, and comparison charts are computed.
6. The user can review the dashboard and export a PDF report.

## Deployment Link

### Live application
- Deployed URL: https://wattmight.vercel.app/

## Notes

This project is intended to provide a professional operational dashboard for live wind forecast analysis. It focuses on real data matching, data interpretation, and transparent performance metrics rather than static mock values.

