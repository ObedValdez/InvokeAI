import json
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path
from queue import Empty, Queue
from typing import Any, cast

from invokeai.app.services.config.config_default import InvokeAIAppConfig
from invokeai.app.services.image_files.image_files_base import ImageFileStorageBase
from invokeai.app.services.shared.sqlite.sqlite_database import SqliteDatabase
from invokeai.app.services.video.schemas import (
    VideoAsset,
    VideoGenerateRequest,
    VideoGenerationLock,
    VideoJob,
    VideoJobStatus,
    VideoProfile,
    VideoProfileCreate,
    VideoProfileMode,
    VideoProfileUpdate,
)
from invokeai.app.util.misc import get_iso_timestamp, uuid_string


class VideoServiceError(RuntimeError):
    pass


class VideoNotFoundError(VideoServiceError):
    pass


class VideoValidationError(VideoServiceError):
    pass


class VideoCancelledError(VideoServiceError):
    pass


class VideoService:
    def __init__(
        self,
        db: SqliteDatabase,
        config: InvokeAIAppConfig,
        image_files: ImageFileStorageBase,
        logger,
    ) -> None:
        self._db = db
        self._config = config
        self._image_files = image_files
        self._logger = logger

        self._queue: Queue[str] = Queue()
        self._stop_event = threading.Event()
        self._worker_thread: threading.Thread | None = None
        self._active_processes: dict[str, subprocess.Popen[str]] = {}
        self._process_lock = threading.Lock()

    def start(self, _invoker) -> None:
        self.outputs_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)

        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                UPDATE video_jobs
                SET status = ?,
                    error = CASE
                        WHEN error IS NULL THEN 'Video generation interrupted by restart'
                        ELSE error
                    END,
                    updated_at = ?
                WHERE status IN (?, ?);
                """,
                (
                    VideoJobStatus.Error.value,
                    get_iso_timestamp(),
                    VideoJobStatus.Running.value,
                    VideoJobStatus.Encoding.value,
                ),
            )
            cursor.execute(
                """--sql
                SELECT id
                FROM video_jobs
                WHERE status = ?
                ORDER BY created_at ASC;
                """,
                (VideoJobStatus.Waiting.value,),
            )
            rows = cursor.fetchall()

        for row in rows:
            self._queue.put(cast(str, row["id"]))

        self._stop_event.clear()
        self._worker_thread = threading.Thread(target=self._run_worker, daemon=True, name="VideoWorker")
        self._worker_thread.start()

    def stop(self, _invoker) -> None:
        self._stop_event.set()

        with self._process_lock:
            processes = list(self._active_processes.items())

        for job_id, process in processes:
            try:
                process.terminate()
            except Exception:
                self._logger.warning(f"Failed to terminate ffmpeg process for job {job_id}")

        if self._worker_thread is not None:
            self._worker_thread.join(timeout=5)

    @property
    def outputs_dir(self) -> Path:
        return self._config.video_outputs_path

    @property
    def temp_dir(self) -> Path:
        return self._config.video_temp_path

    def list_profiles(self) -> list[VideoProfile]:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                SELECT *
                FROM video_profiles
                ORDER BY created_at DESC;
                """
            )
            rows = cursor.fetchall()
        return [self._row_to_profile(dict(row)) for row in rows]

    def get_profile(self, profile_id: str) -> VideoProfile:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                SELECT *
                FROM video_profiles
                WHERE id = ?;
                """,
                (profile_id,),
            )
            row = cursor.fetchone()
        if row is None:
            raise VideoNotFoundError(f"Video profile '{profile_id}' not found")
        return self._row_to_profile(dict(row))

    def create_profile(self, profile: VideoProfileCreate) -> VideoProfile:
        self._validate_profile_mode(profile.mode, profile.consent_checked)
        profile_id = uuid_string()
        now = get_iso_timestamp()

        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                INSERT INTO video_profiles (
                    id,
                    name,
                    mode,
                    consent_checked,
                    generation_lock_json,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    profile_id,
                    profile.name,
                    profile.mode.value,
                    int(profile.consent_checked),
                    profile.generation_lock.model_dump_json(),
                    now,
                    now,
                ),
            )

        return self.get_profile(profile_id)

    def update_profile(self, profile_id: str, changes: VideoProfileUpdate) -> VideoProfile:
        current = self.get_profile(profile_id)

        mode = changes.mode or current.mode
        consent_checked = current.consent_checked if changes.consent_checked is None else changes.consent_checked
        self._validate_profile_mode(mode, consent_checked)

        with self._db.transaction() as cursor:
            if changes.name is not None:
                cursor.execute(
                    """--sql
                    UPDATE video_profiles
                    SET name = ?
                    WHERE id = ?;
                    """,
                    (changes.name, profile_id),
                )

            if changes.mode is not None:
                cursor.execute(
                    """--sql
                    UPDATE video_profiles
                    SET mode = ?
                    WHERE id = ?;
                    """,
                    (changes.mode.value, profile_id),
                )

            if changes.consent_checked is not None:
                cursor.execute(
                    """--sql
                    UPDATE video_profiles
                    SET consent_checked = ?
                    WHERE id = ?;
                    """,
                    (int(changes.consent_checked), profile_id),
                )

            if changes.generation_lock is not None:
                cursor.execute(
                    """--sql
                    UPDATE video_profiles
                    SET generation_lock_json = ?
                    WHERE id = ?;
                    """,
                    (changes.generation_lock.model_dump_json(), profile_id),
                )

            cursor.execute(
                """--sql
                UPDATE video_profiles
                SET updated_at = ?
                WHERE id = ?;
                """,
                (get_iso_timestamp(), profile_id),
            )

        return self.get_profile(profile_id)

    def delete_profile(self, profile_id: str) -> None:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                DELETE FROM video_profiles
                WHERE id = ?;
                """,
                (profile_id,),
            )

    def set_profile_references(self, profile_id: str, image_names: list[str]) -> VideoProfile:
        _ = self.get_profile(profile_id)

        clean_names = [Path(name).name for name in image_names if name.strip()]
        for image_name in clean_names:
            try:
                path = self._image_files.get_path(image_name)
            except Exception as e:
                raise VideoValidationError(f"Reference image '{image_name}' is invalid") from e
            if not path.exists():
                raise VideoValidationError(f"Reference image '{image_name}' was not found")

        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                DELETE FROM video_profile_references
                WHERE profile_id = ?;
                """,
                (profile_id,),
            )

            for order, image_name in enumerate(clean_names):
                cursor.execute(
                    """--sql
                    INSERT INTO video_profile_references (
                        id,
                        profile_id,
                        image_name,
                        sort_order
                    )
                    VALUES (?, ?, ?, ?);
                    """,
                    (uuid_string(), profile_id, image_name, order),
                )

            cursor.execute(
                """--sql
                UPDATE video_profiles
                SET updated_at = ?
                WHERE id = ?;
                """,
                (get_iso_timestamp(), profile_id),
            )

        return self.get_profile(profile_id)

    def list_jobs(self) -> list[VideoJob]:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                SELECT *
                FROM video_jobs
                ORDER BY created_at DESC;
                """
            )
            rows = cursor.fetchall()
        return [self._row_to_job(dict(row)) for row in rows]

    def get_job(self, job_id: str) -> VideoJob:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                SELECT *
                FROM video_jobs
                WHERE id = ?;
                """,
                (job_id,),
            )
            row = cursor.fetchone()
        if row is None:
            raise VideoNotFoundError(f"Video job '{job_id}' not found")
        return self._row_to_job(dict(row))

    def create_job(self, req: VideoGenerateRequest) -> VideoJob:
        profile = self.get_profile(req.profile_id)
        self._validate_profile_mode(profile.mode, profile.consent_checked)

        if len(profile.reference_images) == 0:
            raise VideoValidationError("The profile has no reference images")

        duration = req.duration_sec if req.duration_sec is not None else self._config.video_default_duration_sec
        fps = req.fps if req.fps is not None else self._config.video_default_fps

        payload = {
            "prompt": req.prompt,
            "negative_prompt": req.negative_prompt,
            "duration_sec": duration,
            "fps": fps,
            "width": req.width,
            "height": req.height,
        }

        now = get_iso_timestamp()
        job_id = uuid_string()
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                INSERT INTO video_jobs (
                    id,
                    profile_id,
                    status,
                    progress,
                    error,
                    output_video_id,
                    request_json,
                    cancel_requested,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    job_id,
                    req.profile_id,
                    VideoJobStatus.Waiting.value,
                    0.0,
                    None,
                    None,
                    json.dumps(payload),
                    0,
                    now,
                    now,
                ),
            )

        self._queue.put(job_id)
        return self.get_job(job_id)

    def cancel_job(self, job_id: str) -> None:
        job = self.get_job(job_id)

        if job.status in (VideoJobStatus.Completed, VideoJobStatus.Error, VideoJobStatus.Cancelled):
            return

        now = get_iso_timestamp()
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                UPDATE video_jobs
                SET cancel_requested = 1,
                    updated_at = ?
                WHERE id = ?;
                """,
                (now, job_id),
            )

            if job.status == VideoJobStatus.Waiting:
                cursor.execute(
                    """--sql
                    UPDATE video_jobs
                    SET status = ?,
                        progress = 0,
                        ended_at = ?,
                        updated_at = ?
                    WHERE id = ?;
                    """,
                    (VideoJobStatus.Cancelled.value, now, now, job_id),
                )
                self._cleanup_temp(job_id)

        with self._process_lock:
            process = self._active_processes.get(job_id)
        if process is not None:
            try:
                process.terminate()
            except Exception:
                self._logger.warning(f"Failed to terminate job process for '{job_id}'")

    def list_assets(self) -> list[VideoAsset]:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                SELECT *
                FROM video_assets
                ORDER BY created_at DESC;
                """
            )
            rows = cursor.fetchall()
        return [self._row_to_asset(dict(row)) for row in rows]

    def get_asset(self, asset_id: str) -> VideoAsset:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                SELECT *
                FROM video_assets
                WHERE id = ?;
                """,
                (asset_id,),
            )
            row = cursor.fetchone()
        if row is None:
            raise VideoNotFoundError(f"Video asset '{asset_id}' not found")
        return self._row_to_asset(dict(row))

    def get_asset_path(self, asset_id: str) -> Path:
        asset = self.get_asset(asset_id)
        path = Path(asset.path).resolve()
        if not path.exists():
            raise VideoNotFoundError(f"File for video asset '{asset_id}' not found")
        outputs_dir = self.outputs_dir.resolve()
        if not path.is_relative_to(outputs_dir):
            raise VideoValidationError(f"Invalid stored path for video asset '{asset_id}'")
        return path

    def _run_worker(self) -> None:
        while not self._stop_event.is_set():
            try:
                job_id = self._queue.get(timeout=0.5)
            except Empty:
                continue

            try:
                self._process_job(job_id)
            except VideoCancelledError:
                pass
            except Exception as e:
                self._logger.error(f"Unhandled video worker error for job '{job_id}': {e}")
            finally:
                self._queue.task_done()

    def _process_job(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if job.status != VideoJobStatus.Waiting:
            return

        if self._is_cancel_requested(job_id):
            self._mark_job_cancelled(job_id)
            return

        req = job.request
        profile = self.get_profile(job.profile_id)
        self._validate_profile_mode(profile.mode, profile.consent_checked)

        duration_sec = int(req.get("duration_sec") or self._config.video_default_duration_sec)
        fps = int(req.get("fps") or self._config.video_default_fps)
        width = int(req.get("width") or 1280)
        height = int(req.get("height") or 720)

        self._ensure_free_space(width=width, height=height, fps=fps, duration_sec=duration_sec)

        now = get_iso_timestamp()
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                UPDATE video_jobs
                SET status = ?,
                    progress = ?,
                    error = NULL,
                    started_at = ?,
                    updated_at = ?
                WHERE id = ?;
                """,
                (VideoJobStatus.Running.value, 5.0, now, now, job_id),
            )

        try:
            temp_job_dir = self.temp_dir / job_id
            temp_job_dir.mkdir(parents=True, exist_ok=True)

            keyframe_pattern, keyframe_count = self._prepare_keyframes(
                temp_job_dir=temp_job_dir,
                reference_images=profile.reference_images,
                duration_sec=duration_sec,
                strict_lock=profile.generation_lock.strict_lock,
            )

            with self._db.transaction() as cursor:
                cursor.execute(
                    """--sql
                    UPDATE video_jobs
                    SET status = ?,
                        progress = ?,
                        updated_at = ?
                    WHERE id = ?;
                    """,
                    (VideoJobStatus.Encoding.value, 30.0, get_iso_timestamp(), job_id),
                )

            output_filename = f"{job_id}.mp4"
            output_path = self.outputs_dir / output_filename
            self._encode_video(
                job_id=job_id,
                input_pattern=keyframe_pattern,
                keyframe_count=keyframe_count,
                duration_sec=duration_sec,
                fps=fps,
                width=width,
                height=height,
                output_path=output_path,
            )

            if self._is_cancel_requested(job_id):
                raise VideoCancelledError()

            asset_id = uuid_string()
            created_at = get_iso_timestamp()
            with self._db.transaction() as cursor:
                cursor.execute(
                    """--sql
                    INSERT INTO video_assets (
                        id,
                        filename,
                        duration,
                        fps,
                        width,
                        height,
                        created_at,
                        path,
                        profile_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        asset_id,
                        output_filename,
                        float(duration_sec),
                        fps,
                        width,
                        height,
                        created_at,
                        str(output_path),
                        profile.id,
                    ),
                )

                cursor.execute(
                    """--sql
                    UPDATE video_jobs
                    SET status = ?,
                        progress = ?,
                        output_video_id = ?,
                        ended_at = ?,
                        updated_at = ?
                    WHERE id = ?;
                    """,
                    (
                        VideoJobStatus.Completed.value,
                        100.0,
                        asset_id,
                        created_at,
                        created_at,
                        job_id,
                    ),
                )

        except VideoCancelledError:
            self._mark_job_cancelled(job_id)
            raise
        except Exception as e:
            self._mark_job_error(job_id, str(e))
        finally:
            self._cleanup_temp(job_id)

    def _prepare_keyframes(
        self,
        temp_job_dir: Path,
        reference_images: list[str],
        duration_sec: int,
        strict_lock: bool,
    ) -> tuple[str, int]:
        try:
            source_paths = [self._image_files.get_path(image_name) for image_name in reference_images]
        except Exception as e:
            raise VideoValidationError("One or more reference images are invalid") from e
        if not source_paths:
            raise VideoValidationError("No reference images available")

        keyframe_count = max(2, min(max(duration_sec, 2), 24))

        # In strict lock mode, always use the first reference to maximize identity consistency.
        locked_source_path = source_paths[0]
        for index in range(keyframe_count):
            src_path = locked_source_path if strict_lock else source_paths[index % len(source_paths)]
            if not src_path.exists():
                raise VideoValidationError(f"Reference image '{src_path.name}' was not found")
            dst_name = f"keyframe_{index:05d}.png"
            shutil.copy(src_path, temp_job_dir / dst_name)

        return str(temp_job_dir / "keyframe_%05d.png"), keyframe_count

    def _encode_video(
        self,
        job_id: str,
        input_pattern: str,
        keyframe_count: int,
        duration_sec: int,
        fps: int,
        width: int,
        height: int,
        output_path: Path,
    ) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        keyframe_input_fps = max(keyframe_count / max(duration_sec, 1), 1.0)
        vf = (
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
            f"format=yuv420p,"
            f"minterpolate=fps={fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1"
        )

        command = [
            self._resolve_ffmpeg_executable(),
            "-y",
            "-framerate",
            f"{keyframe_input_fps:.4f}",
            "-i",
            input_pattern,
            "-vf",
            vf,
            "-t",
            str(duration_sec),
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ]

        try:
            process = subprocess.Popen(command)
            with self._process_lock:
                self._active_processes[job_id] = process

            while process.poll() is None:
                if self._is_cancel_requested(job_id):
                    process.terminate()
                    raise VideoCancelledError()
                self._update_job_progress(job_id, 60.0)
                time.sleep(0.25)

            if process.returncode != 0:
                raise VideoServiceError(f"ffmpeg failed with exit code {process.returncode}")

            self._update_job_progress(job_id, 95.0)
        except FileNotFoundError as e:
            raise VideoServiceError(
                "ffmpeg is required but was not found in PATH. Install ffmpeg and retry."
            ) from e
        finally:
            with self._process_lock:
                self._active_processes.pop(job_id, None)

    def _resolve_ffmpeg_executable(self) -> str:
        ffmpeg_in_path = shutil.which("ffmpeg")
        if ffmpeg_in_path:
            return ffmpeg_in_path

        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            winget_link = Path(local_app_data) / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe"
            if winget_link.exists():
                return str(winget_link)

            winget_packages_root = Path(local_app_data) / "Microsoft" / "WinGet" / "Packages"
            for candidate in winget_packages_root.glob("Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe"):
                if candidate.exists():
                    return str(candidate)

        raise VideoServiceError("ffmpeg is required but was not found in PATH or WinGet links.")

    def _update_job_progress(self, job_id: str, progress: float) -> None:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                UPDATE video_jobs
                SET progress = ?,
                    updated_at = ?
                WHERE id = ? AND status IN (?, ?);
                """,
                (
                    progress,
                    get_iso_timestamp(),
                    job_id,
                    VideoJobStatus.Running.value,
                    VideoJobStatus.Encoding.value,
                ),
            )

    def _ensure_free_space(self, width: int, height: int, fps: int, duration_sec: int) -> None:
        free_bytes = shutil.disk_usage(self.outputs_dir).free
        estimated_bytes = max(150 * 1024 * 1024, width * height * fps * max(duration_sec, 1) // 2)

        if free_bytes < estimated_bytes:
            free_mb = free_bytes // (1024 * 1024)
            need_mb = estimated_bytes // (1024 * 1024)
            raise VideoServiceError(
                f"Insufficient disk space for video encoding. Available: {free_mb}MB, required: {need_mb}MB."
            )

    def _is_cancel_requested(self, job_id: str) -> bool:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                SELECT cancel_requested
                FROM video_jobs
                WHERE id = ?;
                """,
                (job_id,),
            )
            row = cursor.fetchone()
        if row is None:
            return True
        return bool(row["cancel_requested"])

    def _mark_job_cancelled(self, job_id: str) -> None:
        now = get_iso_timestamp()
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                UPDATE video_jobs
                SET status = ?,
                    progress = 0,
                    ended_at = ?,
                    updated_at = ?
                WHERE id = ?;
                """,
                (VideoJobStatus.Cancelled.value, now, now, job_id),
            )

    def _mark_job_error(self, job_id: str, error: str) -> None:
        now = get_iso_timestamp()
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                UPDATE video_jobs
                SET status = ?,
                    error = ?,
                    ended_at = ?,
                    updated_at = ?
                WHERE id = ?;
                """,
                (VideoJobStatus.Error.value, error[:2000], now, now, job_id),
            )

    def _cleanup_temp(self, job_id: str) -> None:
        temp_job_dir = self.temp_dir / job_id
        if temp_job_dir.exists():
            shutil.rmtree(temp_job_dir, ignore_errors=True)

    def _validate_profile_mode(self, mode: VideoProfileMode, consent_checked: bool) -> None:
        if (
            mode == VideoProfileMode.RealIdentity
            and self._config.video_require_consent_marker_for_real_identity
            and not consent_checked
        ):
            raise VideoValidationError("Consent is required for real identity mode")

    def _row_to_profile(self, row: dict[str, Any]) -> VideoProfile:
        profile_id = cast(str, row["id"])
        references = self._get_profile_references(profile_id)
        generation_lock_json = cast(str | None, row.get("generation_lock_json"))
        generation_lock_dict = json.loads(generation_lock_json or "{}")

        return VideoProfile(
            id=profile_id,
            name=cast(str, row["name"]),
            mode=VideoProfileMode(cast(str, row["mode"])),
            consent_checked=bool(row["consent_checked"]),
            reference_images=references,
            generation_lock=VideoGenerationLock.model_validate(generation_lock_dict),
            created_at=cast(str, row["created_at"]),
            updated_at=cast(str, row["updated_at"]),
        )

    def _get_profile_references(self, profile_id: str) -> list[str]:
        with self._db.transaction() as cursor:
            cursor.execute(
                """--sql
                SELECT image_name
                FROM video_profile_references
                WHERE profile_id = ?
                ORDER BY sort_order ASC;
                """,
                (profile_id,),
            )
            rows = cursor.fetchall()
        return [cast(str, row["image_name"]) for row in rows]

    def _row_to_job(self, row: dict[str, Any]) -> VideoJob:
        request_dict = json.loads(cast(str, row.get("request_json") or "{}"))
        return VideoJob(
            id=cast(str, row["id"]),
            profile_id=cast(str, row["profile_id"]),
            status=VideoJobStatus(cast(str, row["status"])),
            progress=float(row["progress"]),
            error=cast(str | None, row.get("error")),
            output_video_id=cast(str | None, row.get("output_video_id")),
            request=request_dict,
            created_at=cast(str, row["created_at"]),
            updated_at=cast(str, row["updated_at"]),
        )

    def _row_to_asset(self, row: dict[str, Any]) -> VideoAsset:
        return VideoAsset(
            id=cast(str, row["id"]),
            filename=cast(str, row["filename"]),
            duration=float(row["duration"]),
            fps=int(row["fps"]),
            width=int(row["width"]),
            height=int(row["height"]),
            created_at=cast(str, row["created_at"]),
            path=cast(str, row["path"]),
            profile_id=cast(str | None, row.get("profile_id")),
        )
