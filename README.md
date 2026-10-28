# WattSight

WattSight is a full-stack UK wind forecasting dashboard that compares live BMRS actual generation against forecasted wind generation. The platform is designed for operational planning, portfolio visibility, and quick decision support for day-ahead energy trading and renewable balancing.

## What the application does

The dashboard helps users answer several practical questions:
- How much wind generation was actually produced on a selected day?
- How close was the forecast to the real outcome?
- Which delivery periods were most inaccurate or least reliable?
- What is the latest forecast and how does it compare to actual generation?
- Can the analysis be exported in a professional PDF report for stakeholders?

## Key product features

- Live BMRS data integration for actual wind output and forecast data
- Date-based dashboard selection for delivery periods
- Forecast-vs-actual visual comparison by time bucket
- Accuracy, bias, and error metrics for operational insight
- Explorer view for detailed matched records and period-level inspection
- Methodology section explaining how calculations are performed
- PDF export for stakeholder reporting

## Live deployment

- Frontend: https://wattmight.vercel.app/
- Backend API: https://ghsua.onrender.com/docs

> Note: the backend is hosted on Render, and Render may take 1–2 minutes to respond on the first request after the service has been idle or sleeping. If the dashboard appears to load slowly on the first visit, please wait a minute or two and refresh the page.

## System architecture

```text
Browser / User
   ↓
Next.js frontend (React + TypeScript)
   ↓
FastAPI backend (Python)
   ↓
Elexon BMRS APIs (FUELHH and WINDFOR)
   ↓
Analytics layer for matching, error calculation, and reporting
```

### Frontend
The frontend is built with Next.js and React, and it includes:
- Overview dashboard for selected-date decision support
- Accuracy page summarizing forecasting quality metrics
- Explorer page with detailed actual/forecast comparison rows
- Methodology page explaining the underlying calculations
- PDF report export for sharing or formal review

### Backend
The backend is built with FastAPI and Python and provides:
- live BMRS data retrieval
- route-level abstractions for actual and forecast datasets
- validation of date and time filters
- data normalization and response envelopes
- a clean separation between external data fetch and analytics logic

## Main pages in the product

### Overview
This is the main landing page. It shows:
- selected delivery date
- latest forecast value
- actual generation value
- forecast accuracy score
- forecast vs actual chart over the day
- next delivery period context

### Accuracy
This page focuses on the quality of the forecast. It helps answer:
- How reliable was the forecast for this day?
- Was the forecast consistently above or below actual output?
- How much difference existed between forecast and actual generation?

### Explorer
This page presents detailed period-level data so the user can inspect:
- time bucket
- forecast generation
- actual generation
- error amount
- whether the forecast was valid for that delivery period

### Methodology
This page explains the logic behind the dashboard:
- BMRS actuals and forecasts are pulled from Elexon datasets
- records are matched by delivery period and publish timing
- the most recent eligible forecast before a delivery period is used
- statistical terms such as mean absolute error, bias, and accuracy are defined

## Repository structure

```text
WattSight/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── health.py
│   │   │   │   └── wind.py
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── schemas/
│   │   │   └── wind.py
│   │   └── services/
│   │       ├── analytics_service.py
│   │       └── bmrs_client.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env
├── components/
│   ├── ui/
│   │   └── button.tsx
│   ├── wattsight-dashboard.tsx
│   └── wattsight-live-dashboard.tsx
├── lib/
│   ├── utils.ts
│   └── wind-api.ts
├── public/
├── .env
├── .env.example
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

## Local setup

### Prerequisites
- Node.js 18+
- npm or pnpm
- Python 3.10+
- access to the BMRS upstream dataset through the backend config

### 1. Install frontend dependencies

```bash
npm install
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

Then:

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Frontend:

```env
WATTSIGHT_BACKEND_URL=http://localhost:8000
```

Backend example:

```env
BMRS_BASE_URL=https://data.elexon.co.uk/bmrs/api/v1
FRONTEND_ORIGINS=http://localhost:3000,https://wattmight.vercel.app
HTTP_CONNECT_TIMEOUT=10
HTTP_READ_TIMEOUT=60
HTTP_MAX_RETRIES=2
PORT=10000
```

### 4. Run the backend

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Run the frontend

From the project root:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

API documentation is available at:

```text
http://localhost:8000/docs
```

## How the app works

1. The user opens the portal and selects a delivery date.
2. The frontend requests actual and forecast wind generation from the backend.
3. The backend fetches BMRS datasets and normalizes them into a usable format.
4. Forecasts are matched to actuals using relevant delivery periods and publish timing.
5. Error and accuracy metrics are calculated and displayed in the dashboard.
6. The user can export a PDF report or review period-level details in the Explorer page.

## Notes for deployment and review

This project is intended as a working pilot dashboard for renewable planning and operational energy review. It is built to show live forecasting quality and decision-support metrics using real BMRS data rather than static sample data.

