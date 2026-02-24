from fastapi import APIRouter, Body, HTTPException, Path, Response, status
from fastapi.responses import FileResponse

from invokeai.app.api.dependencies import ApiDependencies
from invokeai.app.services.video import (
    VideoAsset,
    VideoGenerateRequest,
    VideoJob,
    VideoNotFoundError,
    VideoValidationError,
)

videos_router = APIRouter(prefix="/v1/videos", tags=["videos"])


@videos_router.post("/generate", operation_id="generate_video", response_model=VideoJob)
async def generate_video(
    req: VideoGenerateRequest = Body(description="Video generation request"),
) -> VideoJob:
    try:
        return ApiDependencies.invoker.services.video.create_job(req)
    except VideoNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except VideoValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except VideoValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@videos_router.get("/jobs", operation_id="list_video_jobs", response_model=list[VideoJob])
async def list_video_jobs() -> list[VideoJob]:
    return ApiDependencies.invoker.services.video.list_jobs()


@videos_router.get("/jobs/{job_id}", operation_id="get_video_job", response_model=VideoJob)
async def get_video_job(
    job_id: str = Path(description="The job id"),
) -> VideoJob:
    try:
        return ApiDependencies.invoker.services.video.get_job(job_id)
    except VideoNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@videos_router.delete("/jobs/{job_id}", operation_id="cancel_video_job", status_code=204)
async def cancel_video_job(
    job_id: str = Path(description="The job id"),
) -> Response:
    try:
        ApiDependencies.invoker.services.video.cancel_job(job_id)
        return Response(status_code=204)
    except VideoNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@videos_router.get("", operation_id="list_videos", response_model=list[VideoAsset])
async def list_videos() -> list[VideoAsset]:
    return ApiDependencies.invoker.services.video.list_assets()


@videos_router.get("/{video_id}/file", operation_id="get_video_file")
async def get_video_file(video_id: str = Path(description="The generated video id")) -> FileResponse:
    try:
        video = ApiDependencies.invoker.services.video.get_asset(video_id)
        path = ApiDependencies.invoker.services.video.get_asset_path(video_id)
        return FileResponse(
            path,
            media_type="video/mp4",
            filename=video.filename,
            content_disposition_type="inline",
        )
    except VideoNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
