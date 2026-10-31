const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'world_data.json');
const NPC_FILE = path.join(__dirname, 'npc_data.json');

app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));

// Load or initialize world structures
let worldItems = [];
if (fs.existsSync(DATA_FILE)) {
    try { worldItems = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'); } catch (e) { worldItems = []; }
} else {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Load or initialize NPC states (Peanut + future peers)
let npcRegistry = [
    { id: 'peanut', name: 'Peanut', type: 'panda', x: 0, z: 0, rotY: 0, mood: 'Happy', hunger: 88, energy: 92, activity: 'Wandering Town', assignedBedId: null }
];
if (fs.existsSync(NPC_FILE)) {
    try { npcRegistry = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8') || '[]'); } catch (e) {}
} else {
    fs.writeFileSync(NPC_FILE, JSON.stringify(npcRegistry, null, 2), 'utf8');
}

function saveDataToDisk() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(worldItems, null, 2), 'utf8');
        fs.writeFileSync(NPC_FILE, JSON.stringify(npcRegistry, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed saving world/NPC data:', e);
    }
}

// --- NPC Autonomous Simulation & Position Saver ---
setInterval(() => {
    npcRegistry.forEach(npc => {
        npc.hunger = Math.max(0, +(npc.hunger - 0.02).toFixed(1));
        npc.energy = Math.max(0, +(npc.energy - 0.015).toFixed(1));

        // Basic wandering simulation or task check
        const time = Date.now() * 0.001;
        const targetX = Math.sin(time * 0.2 + (npc.id.charCodeAt(0))) * 24;
        const targetZ = Math.cos(time * 0.17 + (npc.id.charCodeAt(0))) * 24;
        
        npc.x += (targetX - npc.x) * 0.05;
        npc.z += (targetZ - npc.z) * 0.05;
        npc.rotY = Math.atan2(targetX - npc.x, targetZ - npc.z);
    });
    // Auto-backup state periodically
    saveDataToDisk();
}, 500);

// Endpoints for World Structures
app.get('/api/world', (req, res) => res.json(worldItems));
app.post('/api/world', (req, res) => {
    if (Array.isArray(req.body)) {
        worldItems = req.body;
        saveDataToDisk();
        return res.json({ success: true, count: worldItems.length });
    }
    res.status(400).json({ error: 'Invalid payload' });
});

// Endpoints for NPCs (Peanut & Peers)
app.get('/api/npcs', (req, res) => res.json(npcRegistry));
app.post('/api/npcs', (req, res) => {
    if (Array.isArray(req.body)) {
        npcRegistry = req.body;
        saveDataToDisk();
        return res.json({ success: true });
    }
    res.status(400).json({ error: 'Invalid NPC payload' });
});

app.listen(PORT, () => console.log('The Badabing Server running on port ' + PORT));
