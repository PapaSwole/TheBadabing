import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Explicit health check route so Render knows the server is alive immediately
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const worldState = {
  bird: {
    name: "Peanut",
    x: 0,
    y: 0,
    z: 0,
    targetX: 0,
    targetZ: -18,
    state: "wandering",
    mood: "exploring"
  },
  connectedClients: 0
};

let stationsList = [];

const waypoints = [
  { x: 0, z: -18 },
  { x: 0, z: -34 },
  { x: 0, z: 0 },
  { x: -22, z: -10 },
  { x: -30, z: -18 },
  { x: -26, z: -26 },
  { x: -42, z: -20 },
  { x: -34, z: -38 },
  { x: 25, z: -10 },
  { x: -25, z: 15 },
  { x: 25, z: 15 }
];

function setRandomPeanutTarget() {
  const wp = waypoints[Math.floor(Math.random() * waypoints.length)];
  worldState.bird.targetX = wp.x + (Math.random() * 3 - 1.5);
  worldState.bird.targetZ = wp.z + (Math.random() * 3 - 1.5);
}

setRandomPeanutTarget();

let lastWaypointTime = Date.now();

setInterval(() => {
  const bird = worldState.bird;
  const dx = bird.targetX - bird.x;
  const dz = bird.targetZ - bird.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.8) {
    const now = Date.now();
    if (now - lastWaypointTime > 2500) {
      setRandomPeanutTarget();
      lastWaypointTime = now;
    }
  } else {
    bird.x += (dx / dist) * 0.11;
    bird.z += (dz / dist) * 0.11;
  }

  broadcast({ type: 'bird:position', bird: worldState.bird });
}, 50);

wss.on('connection', (ws) => {
  worldState.connectedClients++;

  try {
    ws.send(JSON.stringify({
      type: 'init_world',
      state: worldState,
      stations: stationsList
    }));
  } catch (e) {
    console.error("Send error:", e);
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'admin:place_station' && data.station) {
        const { uid, type, gridX, gridZ, rotation, footprintX, footprintZ } = data.station;
        stationsList = stationsList.filter(s => s.uid !== uid);
        stationsList.push({ uid, type, gridX, gridZ, rotation, footprintX, footprintZ });
        broadcast({ type: 'world:stations_updated', stations: stationsList });
      }

      if (data.type === 'admin:delete_station' && data.uid) {
        stationsList = stationsList.filter(s => s.uid !== data.uid);
        broadcast({ type: 'world:stations_updated', stations: stationsList });
      }
    } catch (err) {
      console.error("Error processing WebSocket message:", err);
    }
  });

  ws.on('close', () => {
    worldState.connectedClients = Math.max(0, worldState.connectedClients - 1);
  });

  ws.on('error', (err) => {
    console.error("WebSocket client error:", err.message);
  });
});

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(payload);
      } catch (e) {
        // Ignore dropped socket errors
      }
    }
  });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});