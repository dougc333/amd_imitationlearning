#!/usr/bin/env bash
set -e

echo "== Creating api.py =="

cat << 'EOF' > api.py

from pathlib import Path
from typing import List, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from pydantic import BaseModel
import httpx
import json

app = FastAPI()

# Paths
BASE_DIR = Path(__file__).resolve().parent
CHAT_HTML = BASE_DIR / "chat.html"

# vLLM backend
BACKEND_URL = "http://127.0.0.1:9000/v1/chat/completions"
DEFAULT_MODEL = "tinyllama/tinyllama-1.1b-chat-v1.0"


@app.get("/")
async def index():
    """
    Serve the chat UI HTML.
    Uses an absolute path so it doesn't depend on WorkingDirectory.
    """
    if not CHAT_HTML.exists():
        # Fail with a clear error instead of a generic 500
        raise HTTPException(
            status_code=500,
            detail=f"chat.html not found at {CHAT_HTML}",
        )
    return FileResponse(CHAT_HTML)


class ChatBody(BaseModel):
    model: Optional[str] = None
    messages: List[Dict]


@app.post("/api/chat")
async def api_chat(body: ChatBody):
    """
    Non-streaming proxy to vLLM /v1/chat/completions.
    """
    payload = {
        "model": body.model or DEFAULT_MODEL,
        "messages": body.messages,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(BACKEND_URL, json=payload)
        r.raise_for_status()
        return r.json()


@app.post("/api/chat/stream")
async def api_chat_stream(body: ChatBody):
    """
    Streaming proxy to vLLM /v1/chat/completions.
    Reads SSE lines and re-streams them to the browser.
    """
    payload = {
        "model": body.model or DEFAULT_MODEL,
        "messages": body.messages,
        "stream": True,
    }

    async def gen():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", BACKEND_URL, json=payload) as r:
                    r.raise_for_status()
                    async for line in r.aiter_lines():
                        if not line:
                            continue
                        # vLLM uses "data: ..." per SSE line
                        yield line + "\n"
        except Exception as e:
            # If something breaks, send an error line so the client can show it
            err_obj = {"error": str(e)}
            yield "data: " + json.dumps(err_obj) + "\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/backend")
async def backend_health():
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get("http://127.0.0.1:9000/v1/models")
            r.raise_for_status()
        return {"backend": "ok"}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"backend": "error", "detail": str(e)},
        )


EOF

echo "api.py created."