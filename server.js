import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static('public'));

const worldState = {
  bird: {
    name: "Peanut",
    x: 0, y: 0, z: 0,
    targetX: 5, targetZ: 5,
    state: "wandering",
    mood: "exploring"
  },
  connectedClients: 0
};

// In-memory stations array instead of SQLite for testing
let stationsList = [];

const waypoints = [
  { x: 0, z: -30 },
  { x: 0, z: -10 },
  { x: 0, z: 10 },
  { x: 0, z: 30 },
  { x: -25, z: -20 },
  { x: 25, z: -20 },
  { x: -25, z: 20 },
  { x: 25, z: 20 },
  { x: -40, z: 0 },
  { x: 40, z: 0 }
];

function setRandomPeanutTarget() {
  const wp = waypoints[Math.floor(Math.random() * waypoints.length)];
  worldState.bird.targetX = wp.x + (Math.random() * 6 - 3);
  worldState.bird.targetZ = wp.z + (Math.random() * 6 - 3);
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
    bird.x += (dx / dist) * 0.08;
    bird.z += (dz / dist) * 0.08;
  }

  broadcast({ type: 'bird:position', bird: worldState.bird });
}, 50);

wss.on('connection', (ws) => {
  worldState.connectedClients++;
  console.log(`🔌 Client connected. Total: ${worldState.connectedClients}`);

  ws.send(JSON.stringify({ 
    type: 'init_world', 
    state: worldState, 
    stations: stationsList 
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'admin:place_station') {
        const { uid, type, gridX, gridZ, rotation, footprintX, footprintZ } = data.station;
        // Remove existing if duplicate, then push
        stationsList = stationsList.filter(s => s.uid !== uid);
        stationsList.push({ uid, type, gridX, gridZ, rotation, footprintX, footprintZ });
        broadcast({ type: 'world:stations_updated', stations: stationsList });
      }

      if (data.type === 'admin:delete_station') {
        stationsList = stationsList.filter(s => s.uid !== data.uid);
        broadcast({ type: 'world:stations_updated', stations: stationsList });
      }
    } catch (err) {
      console.error("Error processing WebSocket message:", err);
    }
  });

  ws.on('close', () => {
    worldState.connectedClients--;
  });
});

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🦫 The Badabing server running on port ${PORT}`);
});