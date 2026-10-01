# LoanLens — AI-Powered Loan Agreement Analysis

Upload a loan-agreement PDF → text extraction → clause segmentation →
rule engine + **trained ML classifier** → plain-English summaries →
0–100 risk score + clause-by-clause report.

> LoanLens is an awareness and screening tool. It does **not** provide legal
> advice or determine whether a loan agreement is legally enforceable.

## Contents

1. [What the app does](#1-what-the-app-does)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [First-time setup](#4-first-time-setup-run-once)
5. [How to run](#5-how-to-run-3-terminals-in-order)
6. [How to use the app](#6-how-to-use-the-app-click-path)
7. [Verify everything works](#7-verify-everything-works)
8. [ML model & accuracy](#8-ml-model--accuracy)
9. [Retraining (optional)](#9-retraining-the-model-optional)
10. [API reference](#10-api-reference)
11. [Configuration](#11-configuration-env)
12. [Project structure](#12-project-structure)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. What the app does

- **Upload** a loan-agreement PDF (max 20 MB, see `samples/`).
- **7-stage pipeline** with live progress: upload → extract (PDF/OCR) →
  detect structure → segment clauses → rule engine + ML classification →
  summarise → risk score.
- **Report page** per agreement: 0–100 score + Low/Medium/High band,
  distribution bar, expandable clause cards (original text, summary,
  reason, category, confidence, rule + ML provenance).
- **Dashboard / Agreements / Details / Reports / History / Settings**:
  stats, library, metadata, past reports, live engine status + rulebook.
- **Demo mode**: without MongoDB the server seeds labelled demo
  agreements so the UI is explorable immediately.

## 2. Architecture

```text
Browser :5173 (React + Vite) --/api--> Express API :5000 --HTTP--> FastAPI ML :8000
```

- **client/** — React (Vite) UI. Dev server proxies `/api` to Express.
- **server/** — Express API. Uploads, 7-stage pipeline, 0–100 risk score.

Scoring formula (same both sides, see `server/services/riskService.js`):

```text
Score = ceil( sum(clause weight) / (clauses x 10) x 100 x 1.3 )
weights: Normal 0, Needs Review 3, Risky 10 - bands: Low <= 30, Medium <= 60, High <= 100
```

## 3. Prerequisites

- Node.js 18+ (`node --version`) and Python 3.10+ (`python --version`).
- **MongoDB** running locally (`mongodb://127.0.0.1:27017`) — the server stores
  agreements in the `loanlens` database. [MongoDB Compass](https://www.mongodb.com/products/compass)
  is recommended to browse the data. If `MONGODB_URI` is empty or MongoDB is
  down, the API automatically falls back to a built-in in-memory store.
- **Python ML deps**: `torch`, `transformers`, `scikit-learn` (see
  `ml-service/requirements.txt`). The transformer summariser (`t5-small`) is
  downloaded from Hugging Face on first start (~240 MB, cached afterwards).
- No Docker, no GPU needed for the demo.
- Windows PowerShell commands below (`e:\loanLens` = repo root).

## 4. First-time setup (run once, PowerShell)

```powershell
Copy-Item e:\loanLens\.env.example e:\loanLens\.env

# 1) make sure MongoDB is running (skip if the service is already up)
Get-Service MongoDB*            # Status should be Running
Start-Service MongoDB           # or: net start MongoDB

# 2) node dependencies
cd e:\loanLens\client; npm install
cd e:\loanLens\server; npm install
# or from repo root:  cd e:\loanLens; npm run install:all

# 3) python dependencies (ML service)
cd e:\loanLens\ml-service; pip install -r requirements.txt
# only needed for retraining:  pip install pyarrow datasets
```

The trained artifact (`ml-service/models/artifacts/clause_risk_classifier.joblib`)
is already shipped — **no retrain needed to run**.

### MongoDB Compass (browse the database)

Root `.env` points the API at the local MongoDB server:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/loanlens
```

1. Open **MongoDB Compass** → connect string `mongodb://127.0.0.1:27017` →
   **Connect**.
2. Select the **`loanlens`** database → collection **`agreements`** — this is
   where uploaded documents, clauses and reports are persisted (demo data is
   seeded on first boot).
3. To clear demo data: delete the documents in `agreements` from Compass and
   restart the API.

> Leave `MONGODB_URI` empty to run without MongoDB (in-memory store; data is
> lost on every restart). `GET /api/health` reports which storage is active
> (`dependencies.database.storage`: `mongodb` vs `in-memory`).

## 5. How to run (3 terminals, in order)

### Terminal 1 — ML service :8000 (start FIRST)

```powershell
cd e:\loanLens\ml-service
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Wait for `Uvicorn running on http://127.0.0.1:8000` (~15 s, loads the model).
Leave this window open.

### Terminal 2 — Express API :5000

```powershell
cd e:\loanLens\server
node server.js
```

Leave open. Dev alternative with auto-reload: `npm run dev`.

### Terminal 3 — React UI :5173

```powershell
cd e:\loanLens\client
npm run dev
```

Open **http://127.0.0.1:5173**.

### Root shortcuts (same thing from repo root)

```powershell
cd e:\loanLens
npm run dev:ml      # ml-service :8000
npm run dev:server  # express API :5000
npm run dev:client  # vite UI :5173
```

### Production build (optional)

```powershell
cd e:\loanLens\client
npm run build
```

When `client/dist/` exists, Express serves it at `http://127.0.0.1:5000`,
so only terminals 1 + 2 are needed.

## 6. How to use the app (click path)

1. Open http://127.0.0.1:5173.
2. **Dashboard** — overview, recents, risk distribution (demo data seeds itself).
3. **Upload** — drop `samples/Sample_Loan_Agreement.pdf` (PDF, max 20 MB).
4. Watch `/analyze/:id/processing` — 7 real backend stages, no fake timers.
5. Read `/report/:id` — score (~70 High), distribution, expandable clause
   cards (original text, summary, reason, category, confidence, rule + ML
   provenance).
6. **Agreements / AgreementDetails / Reports / History / Settings** — library,
   metadata, past reports, live engine status + classifier metrics + rulebook.
7. **CSV export** — "Export CSV" button on the Report page.

## 7. Verify everything works

Run after starting all 3 services:

```powershell
# ML live? expect engine=trained-classical, model=trained-tfidf+linearsvc-C05
Invoke-RestMethod http://127.0.0.1:8000/health |
  Select-Object -ExpandProperty engines |
  Select-Object -ExpandProperty classifier

# API live and ML reachable? expect mlService.available=True
(Invoke-RestMethod http://127.0.0.1:5000/api/health).data.dependencies.mlService

# UI live? expect 200
(Invoke-WebRequest http://127.0.0.1:5173/ -UseBasicParsing).StatusCode

# end-to-end (no browser): extraction, classify, summarise, score
cd e:\loanLens
python scripts/smoke_test.py
# expect: OK - the LoanLens ML pipeline completed end to end.
```

## 8. ML model + accuracy

- Engine `trained-classical`, model `trained-tfidf+linearsvc-C05`
  (word 1-2-grams + char 3-5-grams TF-IDF, calibrated LinearSVC,
  class-balanced).
- Data: 8,434 train / 1,779 validation / 759 test clauses
  (lex_glue unfair_tos + CUAD + hand-written loan corpus),
  plus a 1,215-clause unfair_tos hold-out
  (`ml-service/data/dataset_report.json`).
- Metrics (`ml-service/models/artifacts/metrics.json`):
  validation acc **90.3%** / macro-F1 **84.3%**,
  test acc **90.5%** / macro-F1 **84.5%**,
  hold-out acc 93.7% / macro-F1 74.9%.
- Per-class test F1: Normal 0.95, Needs Review 0.83, Risky 0.75.
- Settings page shows engine + model + metrics live from
  `GET /api/dashboard/meta`. The **summarizer** is `transformers:t5-small`
  (a real seq2seq model, loaded via `AutoModelForSeq2SeqLM` on transformers
  5.x); only the classifier claim above is task-trained.

## 9. Retraining the model (optional)

```powershell
cd e:\loanLens\ml-service
pip install -r requirements-ml.txt
pip install pyarrow datasets scikit-learn joblib
python -m training.build_dataset
python -m training.train_classifier
```

Outputs `models/artifacts/clause_risk_classifier.joblib` + `metrics.json`.
Restart the ML service afterwards.

## 10. API reference

Base `http://127.0.0.1:5000/api`:

- `GET /api/health` — liveness + `dependencies.mlService.available`
- `GET /api/dashboard/stats` — aggregate counts, averages, recents
- `GET /api/dashboard/meta` — rulebook + stages + live engine metrics
- `POST /api/agreements/upload` — multipart `file` (PDF) returns `{ id }`
- `POST /api/agreements/:id/analyze` — start async pipeline
- `GET /api/agreements` — list (`?status=&search=&limit=`)
- `GET /api/agreements/:id` — agreement + clauses + stages
- `GET /api/agreements/:id/report` — completed-only report (409 while busy)
- `DELETE /api/agreements/:id` — delete
- `POST /api/agreements/demo` — seed labelled demo agreements

ML base `http://127.0.0.1:8000`: `GET /health`,
`POST /extract`, `POST /classify`, `POST /summarize`, `POST /analyze`.

## 11. Configuration (.env)

Root `.env` (copy of `.env.example`; `server/.env` overrides it).
Key values: `PORT=5000`, `ML_SERVICE_URL=http://127.0.0.1:8000`,
`MONGODB_URI=mongodb://127.0.0.1:27017/loanlens` (empty = in-memory demo
store), `MAX_UPLOAD_MB=20`, `DEMO_MODE=true`, `SEED_DEMO_DATA=true`,
`VITE_API_BASE_URL=/api`, `ENABLE_TRANSFORMERS=true` (loads the `t5-small`
summariser; the classifier only uses a transformer when fine-tuned weights
exist and otherwise keeps the trained TF-IDF model).
The ML service reads the same root `.env`, and Vite dev proxy forwards
`/api` to Express so the browser never hard-codes a host.

## 12. Project structure

```text
loanLens/
+-- README.md  (.env, .env.example, package.json with dev:client dev:server dev:ml)
+-- client/    (React + Vite UI :5173, vite.config.js /api proxy)
+-- server/    (Express API :5000, server.js, routes/, controllers/,
|               services/analysisPipeline mlService riskService ...,
|               rules/riskRules.js, seed/demoData.js, uploads/)
+-- ml-service/ (FastAPI :8000, app.py routes/ pipeline/ rules/ utils/,
|               models/classifier.py, models/artifacts/, training/, data/)
+-- samples/   (Sample_Loan_Agreement.pdf demo upload)
+-- scripts/smoke_test.py (no-browser end-to-end check)
```

## 13. Troubleshooting

- `ml.available=False`: start Terminal 1 first, wait ~15 s, restart server.
- Port in use: `netstat -ano | Select-String '5000|8000|5173'`,
  then `Stop-Process -Id <PID>`.
- `heuristic fallback`: restore or retrain
  `ml-service/models/artifacts/clause_risk_classifier.joblib`, restart ML.
- `rule-based-extractive-fallback` in Settings: the first `t5-small` boot
  downloads ~240 MB from Hugging Face — wait for `Loaded transformer
  summariser` in the ML log, then restart. Requires `ENABLE_TRANSFORMERS=true`.
- `in-memory` instead of `mongodb` in `/api/health`: start MongoDB
  (`Start-Service MongoDB`) and check `MONGODB_URI` in the root `.env`.
- `EADDRINUSE :5000/:8000`: a stale process holds the port —
  `netstat -ano | findstr :5000`, then `taskkill /PID <PID> /F`.
- `REPORT_NOT_READY (409)`: poll `GET /api/agreements/:id` until completed.
- Upload rejected: PDF only, max 20 MB. Scanned PDFs need Tesseract.
- UI blank on :5000: run `npm run build` in `client/` or use `:5173` dev.

