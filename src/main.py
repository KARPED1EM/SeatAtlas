from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pathlib import Path

from src.api.routes import router as api_router
from src.models import get_seat_layout

app = FastAPI(title="SeatAtlas")

# Mount static files
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# Templates
templates_path = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(templates_path))

# Include API routes
app.include_router(api_router)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve the SPA"""
    seat_layout = get_seat_layout()
    return templates.TemplateResponse(
        "index.html", {"request": request, "seat_layout": seat_layout}
    )


# SPA fallback - return index.html for all non-API routes
@app.get("/{full_path:path}", response_class=HTMLResponse)
async def spa_fallback(request: Request, full_path: str):
    """SPA fallback for client-side routing"""
    if full_path.startswith("api/"):
        return {"error": "Not found"}

    seat_layout = get_seat_layout()
    return templates.TemplateResponse(
        "index.html", {"request": request, "seat_layout": seat_layout}
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="127.0.0.1", port=1222, reload=True)
