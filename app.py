# main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
from datetime import datetime

app = FastAPI(title="Render Data API", version="1.0.0")

class DataItem(BaseModel):
    sensor_id: str
    value: float
    unit: str
    metadata: Optional[dict] = None

class StoredData(DataItem):
    id: int
    received_at: str

# In-memory storage
data_storage = []

@app.get("/")
async def root():
    return {"message": "Render FastAPI Server is running!", "status": "active"}

@app.post("/api/data", response_model=dict)
async def create_data(item: DataItem):
    data_id = len(data_storage) + 1
    stored_item = StoredData(
        id=data_id,
        received_at=datetime.now().isoformat(),
        **item.dict()
    )
    
    data_storage.append(stored_item.dict())
    
    return {
        "message": "Data stored successfully",
        "id": data_id,
        "status": "created"
    }

@app.get("/api/data", response_model=dict)
async def get_all_data():
    return {
        "count": len(data_storage),
        "data": data_storage
    }

@app.get("/api/data/{data_id}", response_model=StoredData)
async def get_data(data_id: int):
    if data_id < 1 or data_id > len(data_storage):
        raise HTTPException(status_code=404, detail="Data not found")
    return data_storage[data_id - 1]

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
