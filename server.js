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
    targetX: 0, targetZ: -15,
    state: "wandering",
    mood: "exploring"
  },
  connectedClients: 0
};

let stationsList = [];

// Updated waypoints: Peanut visits his Mansion, Backyard, Street Plaza, and Apeshit Corp!
const waypoints = [
  { x: 0, z: -18 },     // In front of Apeshit Corp Gorilla Statue
  { x: 0, z: -34 },     // Inside Apeshit Corp 1st Floor Lobby
  { x: 0, z: 0 },       // Center Intersection
  { x: -22, z: -10 },   // Approaching Peanut's Mansion Front Door
  { x: -30, z: -18 },   // Inside Peanut's Living Room
  { x: -26, z: -26 },   // Inside Peanut's Kitchen
  { x: -42, z: -20 },   // Inside Peanut's Garage
  { x: -34, z: -38 },   // Out in Peanut's Fenced Backyard
  { x: 25, z: -10 },    // East Street
  { x: -25, z: 15 },    // Southwest Street
  { x: 25, z: 15 }      // Southeast Street
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