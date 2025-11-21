from fastapi import FastAPI, Request
import uvicorn

app = FastAPI()

@app.get("/")
def home():
    return {"status": "API running", "message": "Send POST to /esp"}

@app.post("/esp")
async def esp_data(request: Request):
    data = await request.json()

    print("Received from ESP:", data)

    # Example feedback
    feedback = {
        "server_message": "Data received OK",
        "led_command": "ON" if data.get("value", 0) > 50 else "OFF"
    }

    return feedback

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
