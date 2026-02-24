from fastapi import APIRouter, Body, HTTPException, Path, status

from invokeai.app.api.dependencies import ApiDependencies
from invokeai.app.services.video import (
    AttachReferencesRequest,
    VideoProfile,
    VideoProfileCreate,
    VideoProfileUpdate,
    VideoNotFoundError,
    VideoValidationError,
)

video_profiles_router = APIRouter(prefix="/v1/video_profiles", tags=["video_profiles"])


@video_profiles_router.post("", operation_id="create_video_profile", response_model=VideoProfile)
async def create_video_profile(profile: VideoProfileCreate = Body(description="The profile to create")) -> VideoProfile:
    try:
        return ApiDependencies.invoker.services.video.create_profile(profile)
    except VideoValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@video_profiles_router.get("", operation_id="list_video_profiles", response_model=list[VideoProfile])
async def list_video_profiles() -> list[VideoProfile]:
    return ApiDependencies.invoker.services.video.list_profiles()


@video_profiles_router.get("/{profile_id}", operation_id="get_video_profile", response_model=VideoProfile)
async def get_video_profile(
    profile_id: str = Path(description="The profile id to get"),
) -> VideoProfile:
    try:
        return ApiDependencies.invoker.services.video.get_profile(profile_id)
    except VideoNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@video_profiles_router.put("/{profile_id}", operation_id="update_video_profile", response_model=VideoProfile)
async def update_video_profile(
    profile_id: str = Path(description="The profile id to update"),
    changes: VideoProfileUpdate = Body(description="Changes to apply"),
) -> VideoProfile:
    try:
        return ApiDependencies.invoker.services.video.update_profile(profile_id, changes)
    except VideoNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except VideoValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@video_profiles_router.delete("/{profile_id}", operation_id="delete_video_profile", status_code=204)
async def delete_video_profile(
    profile_id: str = Path(description="The profile id to delete"),
) -> None:
    ApiDependencies.invoker.services.video.delete_profile(profile_id)


@video_profiles_router.post("/{profile_id}/references", operation_id="attach_video_profile_references", response_model=VideoProfile)
async def attach_video_profile_references(
    profile_id: str = Path(description="The profile id"),
    body: AttachReferencesRequest = Body(description="The images to attach as references"),
) -> VideoProfile:
    try:
        return ApiDependencies.invoker.services.video.set_profile_references(profile_id, body.image_names)
    except VideoNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except VideoValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
