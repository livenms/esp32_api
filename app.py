from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

app = FastAPI()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store LED state (you can use a database in production)
led_state = {"command": "OFF", "message": "Hello ESP32"}

@app.get("/")
async def root():
    return {"message": "ESP32 API Server Running"}

# GET endpoint - ESP32 fetches commands
@app.get("/esp")
async def get_esp_commands():
    """ESP32 calls this to get the current LED command"""
    response = {
        "server_message": led_state["message"],
        "led_command": led_state["command"]
    }
    logger.info(f"ESP32 GET request - Sending: {response}")
    return JSONResponse(content=response)

# POST endpoint - For updating commands (from web dashboard, etc.)
@app.post("/esp")
async def update_esp_commands(request: Request):
    """Update LED state (called from web interface or other clients)"""
    try:
        # Handle empty body
        body = await request.body()
        if not body:
            logger.warning("Received empty POST body")
            return JSONResponse(
                content={"error": "Empty request body"},
                status_code=400
            )
        
        data = await request.json()
        logger.info(f"Received POST data: {data}")
        
        # Update stored state
        if "led_command" in data:
            led_state["command"] = data["led_command"]
        if "message" in data:
            led_state["message"] = data["message"]
            
        return JSONResponse(content={
            "status": "success",
            "current_state": led_state
        })
        
    except Exception as e:
        logger.error(f"Error processing POST: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

# Endpoint to manually control LED
@app.post("/control")
async def control_led(request: Request):
    """Manual control endpoint"""
    data = await request.json()
    if "led" in data:
        led_state["command"] = "ON" if data["led"] else "OFF"
        logger.info(f"LED manually set to: {led_state['command']}")
    return JSONResponse(content={"status": "success", "led": led_state["command"]})

@app.get("/status")
async def get_status():
    """Check current LED state"""
    return JSONResponse(content=led_state)
