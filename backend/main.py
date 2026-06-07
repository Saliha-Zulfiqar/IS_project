from . import groq_client
_hf_client_available = False
hf_client = None
from . import feature_extractor
from .risk_scoring import finalize_analysis

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field
from typing import Any, Literal


# Duplicate analyze endpoint removed – primary endpoint uses Groq
logger = logging.getLogger(__name__)

_model_loaded = False

Classification = Literal["PHISHING", "LEGITIMATE"]
RiskLevel = Literal["HIGH", "MEDIUM", "LOW"]
Confidence = Literal["HIGH", "MEDIUM", "LOW"]

RECOMMENDATIONS: dict[RiskLevel, str] = {
    "HIGH": "Do NOT click any links. Delete this email immediately.",
    "MEDIUM": "Proceed with caution. Verify sender before any action.",
    "LOW": "This email appears safe.",
}

if _hf_client_available:
    MODEL_DISPLAY_NAME = f"{hf_client.BASE_MODEL} (LoRA: {hf_client.LORA_MODEL})"
else:
    MODEL_DISPLAY_NAME = "Groq API (no fine‑tuned model)"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the fine-tuned model on startup (first run may download from Hugging Face)."""
    global _model_loaded
    import asyncio

    if _hf_client_available:
        logger.info("Loading Phi-3 + LoRA model (may take 2–3 minutes on first download)…")
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, hf_client.load_model)
            _model_loaded = hf_client._cached_model is not None
            if _model_loaded:
                logger.info("Model loaded successfully.")
            else:
                logger.warning("Model load finished but cache is empty.")
        except Exception as exc:
            _model_loaded = False
            logger.error("Failed to load model at startup: %s", exc)
    else:
        logger.info("Skipping model loading; hf_client unavailable.")
        _model_loaded = False

    yield

    _model_loaded = False


app = FastAPI(
    title="PhishGuard Email Detector API",
    description="Phishing detection using heuristics and a fine-tuned Phi-3 LoRA model.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    sender: str = ""
    subject: str = ""
    body: str = ""


class AnalyzeResponse(BaseModel):
    classification: Classification
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    reasons: str
    confidence: Confidence
    features: dict[str, Any]
    recommendation: str


def risk_level_from_score(score: int) -> RiskLevel:
    if score >= 75:
        return "HIGH"
    if score >= 45:
        return "MEDIUM"
    return "LOW"


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "PhishGuard Email Detector API",
        "model": MODEL_DISPLAY_NAME,
        "docs": "/docs",
        "health": "/health",
        "analyze": "POST /analyze",
    }


@app.get("/health")
def health() -> dict[str, Any]:
    groq_ready = groq_client.client is not None
    api_ready = _model_loaded or groq_ready
    return {
        "status": "ok" if api_ready else "degraded",
        "model": MODEL_DISPLAY_NAME,
        "model_loaded": _model_loaded,
        "groq_ready": groq_ready,
    }
@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    features = feature_extractor.extract_features(
        sender=request.sender,
        subject=request.subject,
        body=request.body,
    )
    analysis = groq_client.analyze_with_groq(
        sender=request.sender,
        subject=request.subject,
        body=request.body,
        features=features,
    )
    analysis = finalize_analysis(features, analysis)
    risk_score = int(analysis.get("risk_score", 0))
    risk_level = risk_level_from_score(risk_score)

    classification = analysis.get("classification", "LEGITIMATE")
    if classification not in ("PHISHING", "LEGITIMATE"):
        classification = "LEGITIMATE"

    confidence = analysis.get("confidence", "LOW")
    if confidence not in ("HIGH", "MEDIUM", "LOW"):
        confidence = "LOW"

    return AnalyzeResponse(
        classification=classification,
        risk_score=risk_score,
        risk_level=risk_level,
        reasons=analysis.get("reasons", ""),
        confidence=confidence,
        features=features,
        recommendation=RECOMMENDATIONS[risk_level],
    )

if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(level=logging.INFO)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
