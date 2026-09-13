# OpenTryOn Server (Virtual Try-On microservice)

Python **FastAPI** microservice (port **8001**) that wraps the core `opentryon`
engine (at `../../../opentryon/`) and proxies to the Kling AI virtual-try-on API.

It is called by the main backend (`backend/app/services/tryon.service.ts`)
via the `OPENTRYON_URL` environment variable (default `http://localhost:8001`).

## Run

```bash
cd backend/services/tryon
pip install -r requirements.txt
python server.py        # serves on http://localhost:8001
```

or from the platform root: `scripts/start-tryon-server.bat`

## Configuration

Copy `.env.example` to `.env` and fill in your Kling AI credentials:

- `KLING_AI_API_KEY` (recommended) or `KLING_AI_SECRET_KEY`
- `KLING_AI_BASE_URL` (default: Singapore region)
- `SERVER_PORT` (default `8001`)

## Notes

- `server.py` inserts the platform-root `opentryon` package on `sys.path`
  (4 levels up from this file) so no install of the engine is required.