import sqlite3

from invokeai.app.services.shared.sqlite_migrator.sqlite_migrator_common import Migration


class Migration27Callback:
    def __call__(self, cursor: sqlite3.Cursor) -> None:
        cursor.execute(
            """--sql
            CREATE TABLE IF NOT EXISTS video_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mode TEXT NOT NULL,
                consent_checked INTEGER NOT NULL DEFAULT 0,
                generation_lock_json TEXT NOT NULL DEFAULT '{}',
                created_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
                updated_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
            );
            """
        )

        cursor.execute(
            """--sql
            CREATE TABLE IF NOT EXISTS video_profile_references (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                image_name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (profile_id) REFERENCES video_profiles (id) ON DELETE CASCADE,
                FOREIGN KEY (image_name) REFERENCES images (image_name) ON DELETE CASCADE,
                UNIQUE (profile_id, image_name)
            );
            """
        )

        cursor.execute(
            """--sql
            CREATE TABLE IF NOT EXISTS video_assets (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                duration REAL NOT NULL,
                fps INTEGER NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                created_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
                path TEXT NOT NULL,
                profile_id TEXT,
                FOREIGN KEY (profile_id) REFERENCES video_profiles (id) ON DELETE SET NULL
            );
            """
        )

        cursor.execute(
            """--sql
            CREATE TABLE IF NOT EXISTS video_jobs (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                status TEXT NOT NULL,
                progress REAL NOT NULL DEFAULT 0,
                error TEXT,
                output_video_id TEXT,
                request_json TEXT NOT NULL DEFAULT '{}',
                cancel_requested INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
                updated_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
                started_at DATETIME,
                ended_at DATETIME,
                FOREIGN KEY (profile_id) REFERENCES video_profiles (id) ON DELETE CASCADE,
                FOREIGN KEY (output_video_id) REFERENCES video_assets (id) ON DELETE SET NULL
            );
            """
        )

        cursor.execute(
            """--sql
            CREATE INDEX IF NOT EXISTS idx_video_profile_references_profile_id
            ON video_profile_references (profile_id);
            """
        )

        cursor.execute(
            """--sql
            CREATE INDEX IF NOT EXISTS idx_video_jobs_profile_id
            ON video_jobs (profile_id);
            """
        )

        cursor.execute(
            """--sql
            CREATE INDEX IF NOT EXISTS idx_video_jobs_status
            ON video_jobs (status);
            """
        )

        cursor.execute(
            """--sql
            CREATE INDEX IF NOT EXISTS idx_video_assets_created_at
            ON video_assets (created_at DESC);
            """
        )


def build_migration_27() -> Migration:
    return Migration(
        from_version=26,
        to_version=27,
        callback=Migration27Callback(),
    )
