# Payment Gateway (Python) — REFERENCE / BACKUP

> **Status: kept for reference only.** This is the standalone Python payment
> gateway (bKash / Nagad / Bank, FastAPI, port **8000**) that was found
> duplicating payment logic already built into the main backend.

The **main payment flow lives in the Node backend**:

- `backend/api/routes/bkash.routes.ts` — bKash STK push
- `backend/api/routes/bank.routes.ts` — manual bank transfer config/verify
- `backend/api/routes/payment.routes.ts` — unified initiate/status (bkash/nagad/stripe)
- `backend/app/services/payment.service.ts`, `bkash.service.ts`, `bank.payment.service.ts`

The frontend and widget only ever call the Node backend on port 5000; nothing in
the running platform calls this Python gateway.

## Why it is here

Per the restructuring decision: **moved, not deleted** — kept as a backup/reference
under `backend/services/payment/` until a decision is made whether to fully merge
any missing features (e.g. Nagad sandbox flow) into the Node services.

## Layout

```
backend/services/payment/
├── payment_gateway/      # the Python package (app.py, api/, core/, models/, migrations/)
├── payment_gateway.db    # SQLite dev database (created when run in development)
└── README.md
```

## Run (only if you need it standalone)

```bash
cd backend/services/payment
pip install -r requirements.txt   # or pip install fastapi uvicorn sqlalchemy python-dotenv
python -m uvicorn payment_gateway.app:app --reload   # serves on port 8000
```

Note: `payment_gateway.db` is resolved relative to the working directory when run.