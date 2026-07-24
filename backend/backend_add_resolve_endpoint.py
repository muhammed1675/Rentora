# =========================================================================
# ADD THIS to backend/server.py (anywhere among the other @api_router routes)
# Also add at the top of the file (if not already present):
#     import httpx
# and in requirements.txt make sure `httpx` is listed.
# =========================================================================

from urllib.parse import urlparse
import httpx

_ALLOWED_MAPS_HOSTS = {
    "maps.app.goo.gl",
    "goo.gl",
    "g.co",
    "maps.google.com",
    "www.google.com",
    "google.com",
}

@api_router.get("/utils/resolve-maps-link")
async def resolve_maps_link(url: str):
    """
    Expand a shortened Google Maps URL (e.g. https://maps.app.goo.gl/xxxx)
    into its full form so the frontend can extract coordinates and embed it.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL")

    if parsed.scheme not in ("http", "https") or parsed.netloc not in _ALLOWED_MAPS_HOSTS:
        raise HTTPException(status_code=400, detail="Only Google Maps links are allowed")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8.0) as client:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        return {"resolved_url": str(r.url)}
    except Exception as e:
        logger.warning(f"Failed to resolve maps link: {e}")
        raise HTTPException(status_code=502, detail="Could not resolve link")
