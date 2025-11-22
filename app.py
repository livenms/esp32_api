from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Add after app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return FileResponse('static/index.html')
