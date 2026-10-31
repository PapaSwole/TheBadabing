const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'world_data.json');
const NPC_FILE = path.join(__dirname, 'npc_data.json');

app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

let worldItems = [];
if (fs.existsSync(DATA_FILE)) {
    try { worldItems = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'); } catch (e) { worldItems = []; }
} else {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
}

let npcRegistry = [
    { id: 'peanut', name: 'Peanut', type: 'panda', x: 0, z: 0, rotY: 0, mood: 'Happy', hunger: 85, energy: 90, activity: 'Wandering Town', assignedBedId: null }
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
        console.error('Failed saving data:', e);
    }
}

// Active Co-op Gods Registry
const activeGods = {};
const GOD_COLORS = ['#fa9549', '#38bdf8', '#4ade80', '#c084fc'];

let peanutState = npcRegistry[0] || {
    x: 0, z: 0, rotY: 0, mood: 'Happy', hunger: 85, energy: 90, activity: 'Wandering Town', assignedBedId: null
};

// Robust Autonomous Simulation Tick for Peanut
let simTick = 0;
setInterval(() => {
    simTick += 0.08;
    
    // Slow down drain so he doesn't panic-walk constantly
    peanutState.hunger = Math.max(10, +(peanutState.hunger - 0.01).toFixed(1));
    peanutState.energy = Math.max(10, +(peanutState.energy - 0.008).toFixed(1));

    const assignedBed = worldItems.find(it => it.id === peanutState.assignedBedId);
    const mcd = worldItems.find(it => it.type === 'mcdonalds');

    if (peanutState.energy < 20 && assignedBed) {
        peanutState.activity = 'Heading to Assigned Bed';
        peanutState.mood = 'Sleepy 😴';
        const dx = assignedBed.x - peanutState.x;
        const dz = assignedBed.z - peanutState.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1.8) {
            peanutState.x += (dx / dist) * 0.25;
            peanutState.z += (dz / dist) * 0.25;
            peanutState.rotY = Math.atan2(dx, dz);
        } else {
            peanutState.activity = 'Sleeping in Bed 💤';
            peanutState.energy = Math.min(100, +(peanutState.energy + 0.5).toFixed(1));
            peanutState.mood = 'Rested ✨';
        }
    } else if (peanutState.hunger < 20 && mcd) {
        peanutState.activity = "Visiting McDonald's 🍔";
        peanutState.mood = 'Hungry 😋';
        const dx = mcd.x - peanutState.x;
        const dz = mcd.z - peanutState.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 2.8) {
            peanutState.x += (dx / dist) * 0.25;
            peanutState.z += (dz / dist) * 0.25;
            peanutState.rotY = Math.atan2(dx, dz);
        } else {
            peanutState.activity = 'Eating Burgers 🍟';
            peanutState.hunger = Math.min(100, +(peanutState.hunger + 0.6).toFixed(1));
            peanutState.mood = 'Ecstatic 🎉';
        }
    } else {
        // Default Smooth Circular Wandering Loop across the town
        peanutState.activity = peanutState.assignedBedId ? 'Patrolling Near Home' : 'Wandering Town 🐼';
        peanutState.mood = peanutState.hunger > 50 && peanutState.energy > 50 ? 'Happy ✨' : 'Chill';
        
        const nextX = Math.sin((simTick + 0.05) * 0.25) * 24;
        const nextZ = Math.cos((simTick + 0.05) * 0.2) * 24;
        const curX = Math.sin(simTick * 0.25) * 24;
        const curZ = Math.cos(simTick * 0.2) * 24;

        peanutState.x = curX;
        peanutState.z = curZ;
        peanutState.rotY = Math.atan2(nextX - curX, nextZ - curZ);
    }
}, 80);

app.post('/api/coop/sync', (req, res) => {
    const now = Date.now();
    for (const id of Object.keys(activeGods)) {
        if (now - activeGods[id].lastSeen > 6000) delete activeGods[id];
    }

    const { id, x, y, z, rotY } = req.body || {};
    if (id) {
        if (!activeGods[id]) {
            const currentIds = Object.keys(activeGods);
            if (currentIds.length < 4) {
                const usedSlots = currentIds.map(k => activeGods[k].slot);
                let slot = 1;
                while (usedSlots.includes(slot) && slot <= 4) slot++;
                activeGods[id] = {
                    id, slot, name: 'God ' + slot,
                    color: GOD_COLORS[(slot - 1) % 4],
                    x: x || 0, y: y || 3, z: z || 20, rotY: rotY || 0, lastSeen: now
                };
            }
        } else {
            activeGods[id].x = typeof x === 'number' ? x : activeGods[id].x;
            activeGods[id].y = typeof y === 'number' ? y : activeGods[id].y;
            activeGods[id].z = typeof z === 'number' ? z : activeGods[id].z;
            activeGods[id].rotY = typeof rotY === 'number' ? rotY : activeGods[id].rotY;
            activeGods[id].lastSeen = now;
        }
    }

    res.json({
        gods: Object.values(activeGods),
        peanut: peanutState,
        worldCount: worldItems.length
    });
});

app.post('/api/peanut/override', (req, res) => {
    const { mood, hunger, energy, activity, assignedBedId } = req.body || {};
    if (mood !== undefined) peanutState.mood = mood;
    if (hunger !== undefined) peanutState.hunger = Number(hunger);
    if (energy !== undefined) peanutState.energy = Number(energy);
    if (activity !== undefined) peanutState.activity = activity;
    if (assignedBedId !== undefined) peanutState.assignedBedId = assignedBedId;
    res.json({ success: true, peanut: peanutState });
});

app.get('/api/world', (req, res) => res.json(worldItems));
app.post('/api/world', (req, res) => {
    if (Array.isArray(req.body)) {
        worldItems = req.body;
        saveDataToDisk();
        return res.json({ success: true, count: worldItems.length });
    }
    res.status(400).json({ error: 'Invalid payload' });
});

app.post('/api/world/update-item', (req, res) => {
    const { id, isOpen, inventory, assignedTo } = req.body || {};
    const target = worldItems.find(it => it.id === id);
    if (!target) return res.status(404).json({ error: 'Item not found' });

    if (typeof isOpen === 'boolean') target.isOpen = isOpen;
    if (Array.isArray(inventory)) target.inventory = inventory.slice(0, 10);
    if (assignedTo !== undefined) {
        target.assignedTo = assignedTo;
        if (assignedTo === 'Peanut') {
            peanutState.assignedBedId = target.id;
        }
    }
    saveDataToDisk();
    res.json({ success: true, item: target, peanut: peanutState });
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log('The Badabing Server running on port ' + PORT));
