from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import math

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. DEFINE COMPLEX TRACK GEOMETRY ---
# We pre-calculate points for 3 different tracks
TRACKS = {}

# Track 1: The "Main Loop" (Ellipse)
t = np.linspace(0, 2*np.pi, 200)
TRACKS["main_loop"] = [{"x": float(np.cos(i)*0.8), "y": float(np.sin(i)*0.8)} for i in t]

# Track 2: The "Cross Line" (Diagonal Straight)
l = np.linspace(-0.9, 0.9, 100)
TRACKS["cross_line"] = [{"x": float(i), "y": float(i * -0.5)} for i in l]

# Track 3: The "Scenic Route" (Winding Sine Wave)
s = np.linspace(-1, 1, 150)
TRACKS["scenic_route"] = [{"x": float(i), "y": float(np.sin(i*4)*0.3 + 0.5)} for i in s]

# --- 2. TRAIN STATE ---
# Each train is assigned to a specific track_id
trains = [
    {"id": "Train-101", "track": "main_loop", "idx": 0, "speed": 2, "status": "On Time", "color": "#3b82f6"}, # Blue
    {"id": "Train-404", "track": "cross_line", "idx": 10, "speed": 1, "status": "On Time", "color": "#ef4444"}, # Red (The Incident Train)
    {"id": "Freight-99", "track": "scenic_route", "idx": 50, "speed": 1, "status": "Delayed", "color": "#10b981"} # Green
]

@app.get("/network-data")
async def get_network_data():
    """Returns the static track geometry (call once on load)"""
    return TRACKS

@app.get("/live-positions")
async def get_positions():
    """Returns the dynamic train coordinates"""
    global trains
    
    updates = []
    for t in trains:
        track_pts = TRACKS[t["track"]]
        
        # 1. Move the train
        if "STUCK" not in t["status"]:
            # Loop around if it's the main loop, otherwise bounce or restart
            if t["track"] == "main_loop":
                t["idx"] = (t["idx"] + t["speed"]) % len(track_pts)
            else:
                # Ping-pong or restart logic for open lines
                t["idx"] += t["speed"]
                if t["idx"] >= len(track_pts): t["idx"] = 0
        
        # 2. Get exact coordinate
        current_pt = track_pts[int(t["idx"])]
        
        updates.append({
            "id": t["id"],
            "status": t["status"],
            "x": current_pt["x"],
            "y": current_pt["y"],
            "color": t["color"]
        })
        
    return updates

@app.post("/trigger-incident/{train_id}")
async def trigger_incident(train_id: str):
    for t in trains:
        if t["id"] == train_id:
            t["status"] = "STUCK: DEBRIS"
            t["speed"] = 0
    return {"status": "Incident Triggered"}

@app.post("/resolve-incident/{train_id}")
async def resolve_incident(train_id: str):
    for t in trains:
        if t["id"] == train_id:
            t["status"] = "On Time"
            t["speed"] = 1 # Resume speed
    return {"status": "Incident Resolved"}