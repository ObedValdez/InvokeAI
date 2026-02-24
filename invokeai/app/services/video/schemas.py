from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class VideoProfileMode(str, Enum):
    Fictional = "fictional"
    RealIdentity = "real_identity"


class VideoJobStatus(str, Enum):
    Waiting = "waiting"
    Running = "running"
    Encoding = "encoding"
    Completed = "completed"
    Error = "error"
    Cancelled = "cancelled"


class VideoGenerationLock(BaseModel):
    base_model: str | None = Field(default=None)
    loras: list[str] = Field(default_factory=list)
    vae: str | None = Field(default=None)
    prompt_template: str | None = Field(default=None)
    negative_prompt: str | None = Field(default=None)
    cfg_scale: float | None = Field(default=None)
    seed: int | None = Field(default=None)
    seed_strategy: str | None = Field(default=None)
    seed_jitter: int = Field(default=0)
    reference_weight: float = Field(default=1.0)
    strict_lock: bool = Field(default=True)


class VideoProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    mode: VideoProfileMode = Field(default=VideoProfileMode.Fictional)
    consent_checked: bool = Field(default=False)
    generation_lock: VideoGenerationLock = Field(default_factory=VideoGenerationLock)


class VideoProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    mode: VideoProfileMode | None = Field(default=None)
    consent_checked: bool | None = Field(default=None)
    generation_lock: VideoGenerationLock | None = Field(default=None)


class VideoProfile(BaseModel):
    id: str
    name: str
    mode: VideoProfileMode
    consent_checked: bool
    reference_images: list[str]
    generation_lock: VideoGenerationLock
    created_at: str
    updated_at: str


class AttachReferencesRequest(BaseModel):
    image_names: list[str] = Field(default_factory=list)


class VideoGenerateRequest(BaseModel):
    profile_id: str = Field(min_length=1)
    prompt: str | None = Field(default=None)
    negative_prompt: str | None = Field(default=None)
    duration_sec: int | None = Field(default=None, ge=1, le=30)
    fps: int | None = Field(default=None, ge=4, le=60)
    width: int = Field(default=1280, ge=256, le=1920)
    height: int = Field(default=720, ge=256, le=1920)


class VideoJob(BaseModel):
    id: str
    profile_id: str
    status: VideoJobStatus
    progress: float
    error: str | None
    output_video_id: str | None
    request: dict[str, Any]
    created_at: str
    updated_at: str


class VideoAsset(BaseModel):
    id: str
    filename: str
    duration: float
    fps: int
    width: int
    height: int
    created_at: str
    path: str
    profile_id: str | None
