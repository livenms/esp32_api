const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for cross-origin requests
app.use(cors());

// Parse JSON requests
app.use(express.json());

// Serve static files (web page)
app.use(express.static(path.join(__dirname, "public")));

// API endpoint to forward commands to ROS 2
app.post("/cmd_vel", async (req, res) => {
    const { linear = 0, angular = 0 } = req.body;

    // Forward to ROS 2 node (replace with your ROS 2 node URL)
    const rosNodeUrl = "http://<robot_ip>:5000/cmd_vel";

    try {
        const response = await fetch(rosNodeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ linear, angular })
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("Error sending to ROS 2 node:", err);
        res.status(500).json({ error: "Failed to send to ROS 2 node" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
