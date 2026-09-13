import os
import sys
import uuid
import time
import base64
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# The core try-on engine lives at the platform root: stitch-rup-platform/opentryon.
# Walk up from backend/services/tryon (4 levels) to find it.
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "opentryon"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="OpenTryOn Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs_store = {}

KLING_API_KEY = os.getenv("KLING_AI_API_KEY", "")
KLING_SECRET_KEY = os.getenv("KLING_AI_SECRET_KEY", "")
KLING_BASE_URL = os.getenv("KLING_AI_BASE_URL", "https://api-singapore.klingai.com")


class TryOnRequest(BaseModel):
    person_image: str
    garment_image: str
    model: Optional[str] = "kolors-virtual-try-on-v1-5"


class TryOnResponse(BaseModel):
    job_id: str
    status: str


class StatusResponse(BaseModel):
    job_id: str
    status: str
    result_url: Optional[str] = None
    error_message: Optional[str] = None


class ResultResponse(BaseModel):
    job_id: str
    status: str
    result_image_url: Optional[str] = None
    error_message: Optional[str] = None


def get_auth_headers():
    if KLING_SECRET_KEY:
        import jwt as pyjwt
        from datetime import datetime, timezone
        headers = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "iss": KLING_API_KEY,
            "exp": datetime.now(tz=timezone.utc).timestamp() + 1800,
            "nbf": datetime.now(tz=timezone.utc).timestamp() - 5,
        }
        token = pyjwt.encode(payload, KLING_SECRET_KEY, algorithm="HS256", headers=headers)
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    else:
        return {"Authorization": f"Bearer {KLING_API_KEY}", "Content-Type": "application/json"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "provider": "kling-ai"}


@app.post("/tryon", response_model=TryOnResponse)
async def create_tryon(request: TryOnRequest):
    if not KLING_API_KEY:
        raise HTTPException(status_code=500, detail="Kling AI API key not configured")

    job_id = f"job_{uuid.uuid4().hex}"

    try:
        import requests as req

        payload = {
            "model_name": request.model or "kolors-virtual-try-on-v1-5",
            "human_image": request.person_image,
            "cloth_image": request.garment_image,
        }

        headers = get_auth_headers()

        response = req.post(
            f"{KLING_BASE_URL}/v1/images/kolors-virtual-try-on",
            headers=headers,
            json=payload,
            timeout=30,
        )

        response.raise_for_status()
        data = response.json()

        if data.get("code") != 0:
            raise HTTPException(
                status_code=400,
                detail=data.get("message", "Kling API error"),
            )

        task_id = data.get("data", {}).get("task_id", job_id)

        jobs_store[task_id] = {
            "status": "processing",
            "result_url": None,
            "error_message": None,
            "created_at": time.time(),
            "kling_task_id": task_id,
        }

        return TryOnResponse(job_id=task_id, status="processing")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tryon/{job_id}/status", response_model=StatusResponse)
async def get_status(job_id: str):
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs_store[job_id]

    if job["status"] == "completed":
        return StatusResponse(
            job_id=job_id,
            status="completed",
            result_url=job["result_url"],
        )

    if job["status"] == "failed":
        return StatusResponse(
            job_id=job_id,
            status="failed",
            error_message=job["error_message"],
        )

    try:
        import requests as req

        headers = get_auth_headers()

        response = req.get(
            f"{KLING_BASE_URL}/v1/images/kolors-virtual-try-on/{job_id}",
            headers=headers,
            timeout=30,
        )

        response.raise_for_status()
        data = response.json()

        if data.get("code") != 0:
            return StatusResponse(
                job_id=job_id,
                status="processing",
            )

        task_data = data.get("data", {})
        task_status = task_data.get("task_status", "").lower()

        if task_status == "succeed":
            images = task_data.get("task_result", {}).get("images", [])
            if images and len(images) > 0:
                result_url = images[0].get("url", "")
                jobs_store[job_id]["status"] = "completed"
                jobs_store[job_id]["result_url"] = result_url
                return StatusResponse(
                    job_id=job_id,
                    status="completed",
                    result_url=result_url,
                )

        elif task_status == "failed":
            error_msg = task_data.get("task_status_msg", "Try-on failed")
            jobs_store[job_id]["status"] = "failed"
            jobs_store[job_id]["error_message"] = error_msg
            return StatusResponse(
                job_id=job_id,
                status="failed",
                error_message=error_msg,
            )

        return StatusResponse(job_id=job_id, status="processing")

    except Exception:
        return StatusResponse(job_id=job_id, status="processing")


@app.get("/tryon/{job_id}/result", response_model=ResultResponse)
async def get_result(job_id: str):
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs_store[job_id]

    if job["status"] == "completed":
        return ResultResponse(
            job_id=job_id,
            status="completed",
            result_image_url=job["result_url"],
        )

    if job["status"] == "failed":
        return ResultResponse(
            job_id=job_id,
            status="failed",
            error_message=job["error_message"],
        )

    return ResultResponse(
        job_id=job_id,
        status="processing",
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("SERVER_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
