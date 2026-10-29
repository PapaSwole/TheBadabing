import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static('public'));

let db;

async function initDB() {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS safehouse_stations (
      uid TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      gridX INTEGER NOT NULL,
      gridZ INTEGER NOT NULL,
      rotation INTEGER NOT NULL,
      footprintX INTEGER NOT NULL,
      footprintZ INTEGER NOT NULL
    )
  `);

  console.log("📦 SQLite Database Connected & The Badabing Tables Verified.");
}

const worldState = {
  bird: {
    name: "Peanut",
    x: 0, y: 0, z: 0,
    targetX: 0, targetZ: 0,
    state: "wandering",
    mood: "exploring"
  },
  connectedClients: 0
};

// Expanded town waypoints covering the entire realistic street grid
const waypoints = [
  { x: 0, z: -30 },   // Badabing HQ North
  { x: 0, z: -10 },   // Central Intersection North
  { x: 0, z: 10 },    // Central Intersection South
  { x: 0, z: 30 },    // South Plaza
  { x: -25, z: -20 }, // Northwest Supply Depot
  { x: 25, z: -20 },  // Northeast Bodega
  { x: -25, z: 20 },  // Southwest Hardware
  { x: 25, z: 20 },   // Southeast Arms
  { x: -40, z: 0 },   // West Avenue
  { x: 40, z: 0 }     // East Avenue
];

function setRandomPeanutTarget() {
  const wp = waypoints[Math.floor(Math.random() * waypoints.length)];
  // Add slight random offset so he doesn't hit the exact same pixel every time
  worldState.bird.targetX = wp.x + (Math.random() * 6 - 3);
  worldState.bird.targetZ = wp.z + (Math.random() * 6 - 3);
}

setRandomPeanutTarget();

// Autonomous AI Loop for Peanut roaming freely across the map
setInterval(() => {
  const bird = worldState.bird;
  const dx = bird.targetX - bird.x;
  const dz = bird.targetZ - bird.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.6) {
    setTimeout(() => {
      setRandomPeanutTarget();
    }, 2000); // Pause briefly at each destination before walking to the next
  } else {
    bird.x += (dx / dist) * 0.06; // Smooth walking speed
    bird.z += (dz / dist) * 0.06;
  }

  broadcast({ type: 'bird:position', bird: worldState.bird });
}, 50);

wss.on('connection', (ws) => {
  worldState.connectedClients++;
  console.log(`🔌 Client connected. Total: ${worldState.connectedClients}`);

  db.all(`SELECT * FROM safehouse_stations`).then((stations) => {
    ws.send(JSON.stringify({ type: 'init_world', state: worldState, stations }));
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'admin:place_station') {
        const { uid, type, gridX, gridZ, rotation, footprintX, footprintZ } = data.station;
        await db.run(
          `INSERT OR REPLACE INTO safehouse_stations (uid, type, gridX, gridZ, rotation, footprintX, footprintZ) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uid, type, gridX, gridZ, rotation, footprintX, footprintZ]
        );
        const allStations = await db.all(`SELECT * FROM safehouse_stations`);
        broadcast({ type: 'world:stations_updated', stations: allStations });
      }

      if (data.type === 'admin:delete_station') {
        await db.run(`DELETE FROM safehouse_stations WHERE uid = ?`, [data.uid]);
        const allStations = await db.all(`SELECT * FROM safehouse_stations`);
        broadcast({ type: 'world:stations_updated', stations: allStations });
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

initDB().then(() => {
  const PORT = process.env.PORT || 10000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🦫 Peanut's server running at The Badabing on port ${PORT}`);
  });
});