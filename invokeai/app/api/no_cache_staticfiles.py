from pathlib import Path
from typing import Any

from starlette.responses import Response
from starlette.staticfiles import StaticFiles


class NoCacheStaticFiles(StaticFiles):
    """
    This class is used to override the default caching behavior of starlette for static files,
    ensuring we *never* cache static files. It modifies the file response headers to strictly
    never cache the files.

    Static files include the javascript bundles, fonts, locales, and some images. Generated
    images are not included, as they are served by a router.
    """

    def __init__(self, *args: Any, **kwargs: Any):
        self.cachecontrol = "max-age=0, no-cache, no-store, , must-revalidate"
        self.pragma = "no-cache"
        self.expires = "0"
        super().__init__(*args, **kwargs)

    def file_response(self, *args: Any, **kwargs: Any) -> Response:
        resp = super().file_response(*args, **kwargs)
        resp.headers.setdefault("Cache-Control", self.cachecontrol)
        resp.headers.setdefault("Pragma", self.pragma)
        resp.headers.setdefault("Expires", self.expires)
        return resp


class SmartCacheStaticFiles(StaticFiles):
    """Static file caching tuned for fast web UI loads.

    Rules:
    - HTML entry points: always revalidate (fresh deploy pickup)
    - Hashed build assets: long-lived immutable cache
    - Locales and other static files: short/medium cache
    """

    _HTML_CACHE = "no-cache"
    _IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
    _LOCALES_CACHE = "public, max-age=86400"
    _DEFAULT_CACHE = "public, max-age=3600"

    def file_response(self, *args: Any, **kwargs: Any) -> Response:
        resp = super().file_response(*args, **kwargs)

        scope = kwargs.get("scope")
        if scope is None and len(args) >= 3 and isinstance(args[2], dict):
            scope = args[2]
        request_path = ""
        if isinstance(scope, dict):
            request_path = str(scope.get("path", ""))

        suffix = Path(request_path).suffix.lower()
        cache_control = self._DEFAULT_CACHE

        if request_path == "/" or suffix == ".html":
            cache_control = self._HTML_CACHE
        elif "/assets/" in request_path:
            cache_control = self._IMMUTABLE_CACHE
        elif "/locales/" in request_path:
            cache_control = self._LOCALES_CACHE

        resp.headers["Cache-Control"] = cache_control
        if "Pragma" in resp.headers:
            del resp.headers["Pragma"]
        if "Expires" in resp.headers:
            del resp.headers["Expires"]
        return resp
