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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS dead_drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_name TEXT,
      message TEXT,
      location_id TEXT,
      status TEXT DEFAULT 'unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("📦 SQLite Database Connected & The Badabing Tables Verified.");
}

const worldState = {
  bird: {
    name: "Peanut",
    x: 0, y: 0, z: 0,
    targetX: 0, targetZ: 0,
    state: "idle",
    mood: "curious",
    energy: 100
  },
  timeOfDay: "night",
  connectedClients: 0
};

wss.on('connection', (ws) => {
  worldState.connectedClients++;
  console.log(`🔌 Client connected to The Badabing. Total: ${worldState.connectedClients}`);

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

setInterval(() => {
  if (worldState.bird.state === 'walking') {
    const dx = worldState.bird.targetX - worldState.bird.x;
    const dz = worldState.bird.targetZ - worldState.bird.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.1) {
      worldState.bird.x = worldState.bird.targetX;
      worldState.bird.z = worldState.bird.targetZ;
      worldState.bird.state = 'idle';
    } else {
      worldState.bird.x += (dx / dist) * 0.05;
      worldState.bird.z += (dz / dist) * 0.05;
    }
    broadcast({ type: 'bird:position', bird: worldState.bird });
  }
}, 100);

initDB().then(() => {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🦫 Peanut's server running at The Badabing on port ${PORT}`);
  });
});