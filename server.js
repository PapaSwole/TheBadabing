const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'world_data.json');
const NPC_FILE = path.join(__dirname, 'npc_data.json');

app.use(express.json({ limit: '25mb' }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

let worldItems = [];
if (fs.existsSync(DATA_FILE)) {
    try {
        worldItems = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
    } catch (e) {
        worldItems = [];
    }
}

function createDefaultPeanut() {
    return {
        id: 'peanut',
        name: 'Peanut',
        species: 'panda',
        x: 0,
        z: 8,
        rotY: 0,
        targetX: 12,
        targetZ: 12,
        mood: 'Happy ✨',
        hunger: 88,
        energy: 92,
        activity: 'Wandering Town',
        assignedBedId: null,
        wants: ['Eat a McDonald\'s Burger 🍔', 'Get a Cozy Bed 🛌', 'Visit a Merchant Shop 🏪'],
        diary: [
            'Woke up feeling super cute in The Badabing!',
            'Looking forward to seeing what the Gorilla Gods build today.'
        ],
        activityLog: [
            '[' + new Date().toLocaleTimeString() + '] Spawned in town center.'
        ]
    };
}

let npcs = [];
if (fs.existsSync(NPC_FILE)) {
    try {
        npcs = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8') || '[]');
    } catch (e) {
        npcs = [];
    }
}
if (!Array.isArray(npcs) || npcs.length === 0) {
    npcs = [createDefaultPeanut()];
}

function saveAllToDisk() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(worldItems, null, 2), 'utf8');
        fs.writeFileSync(NPC_FILE, JSON.stringify(npcs, null, 2), 'utf8');
    } catch (e) {
        console.error('Disk save error:', e.message);
    }
}
saveAllToDisk();

function addLog(npc, text) {
    if (!Array.isArray(npc.activityLog)) npc.activityLog = [];
    const entry = '[' + new Date().toLocaleTimeString() + '] ' + text;
    if (npc.activityLog[0] !== entry) {
        npc.activityLog.unshift(entry);
        if (npc.activityLog.length > 25) npc.activityLog.pop();
    }
}

function addDiary(npc, text) {
    if (!Array.isArray(npc.diary)) npc.diary = [];
    const entry = 'Dear Diary: ' + text;
    if (npc.diary[0] !== entry) {
        npc.diary.unshift(entry);
        if (npc.diary.length > 20) npc.diary.pop();
    }
}

// Active Gorilla Gods Registry (Max 4)
const activeGods = {};
const GOD_COLORS = ['#fa9549', '#38bdf8', '#4ade80', '#c084fc'];

// Continuous Autonomous Simulation for Peanut & All Spawned Companions
let tickCount = 0;
setInterval(() => {
    tickCount++;
    npcs.forEach((npc) => {
        npc.hunger = Math.max(10, +(npc.hunger - 0.012).toFixed(2));
        npc.energy = Math.max(10, +(npc.energy - 0.01).toFixed(2));

        const assignedBed = worldItems.find(it => it.id === npc.assignedBedId);
        const mcd = worldItems.find(it => it.type === 'mcdonalds');

        let destX = npc.targetX;
        let destZ = npc.targetZ;

        if (npc.energy < 25 && assignedBed) {
            destX = assignedBed.x;
            destZ = assignedBed.z;
            if (npc.activity !== 'Heading to Bed 🛌') {
                npc.activity = 'Heading to Bed 🛌';
                npc.mood = 'Sleepy 😴';
                addLog(npc, 'Feeling tired, walking to assigned bed.');
            }
        } else if (npc.hunger < 30 && mcd) {
            destX = mcd.x;
            destZ = mcd.z;
            if (npc.activity !== "Heading to McDonald's 🍔") {
                npc.activity = "Heading to McDonald's 🍔";
                npc.mood = 'Hungry 😋';
                addLog(npc, "Walking to McDonald's for food.");
            }
        } else {
            // Pick a new random town waypoint when close to target
            if (typeof destX !== 'number' || typeof destZ !== 'number' || Math.hypot(destX - npc.x, destZ - npc.z) < 2.2) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 10 + Math.random() * 45;
                npc.targetX = +(Math.cos(angle) * radius).toFixed(1);
                npc.targetZ = +(Math.sin(angle) * radius).toFixed(1);
                destX = npc.targetX;
                destZ = npc.targetZ;
                npc.activity = 'Strolling to (' + Math.round(destX) + ', ' + Math.round(destZ) + ')';
                npc.mood = (npc.hunger > 55 && npc.energy > 55) ? 'Happy ✨' : 'Curious 🐾';
            }
        }

        const dx = destX - npc.x;
        const dz = destZ - npc.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.6) {
            const step = 0.22;
            npc.x = +(npc.x + (dx / dist) * step).toFixed(2);
            npc.z = +(npc.z + (dz / dist) * step).toFixed(2);
            npc.rotY = +(Math.atan2(dx, dz)).toFixed(2);
        } else {
            if (npc.energy < 25 && assignedBed) {
                npc.activity = 'Sleeping in Bed 💤';
                npc.energy = Math.min(100, +(npc.energy + 0.8).toFixed(1));
                npc.mood = 'Well Rested 🌟';
                if (npc.energy >= 95) addDiary(npc, 'Had the best nap in my cozy bed!');
            } else if (npc.hunger < 30 && mcd) {
                npc.activity = 'Eating Happy Meal 🍟';
                npc.hunger = Math.min(100, +(npc.hunger + 0.9).toFixed(1));
                npc.mood = 'Full & Happy 🍔';
                if (npc.hunger >= 95) addDiary(npc, "Ate delicious burgers at McDonald's!");
            }
        }
    });

    // Save NPC positions to disk every ~5 seconds
    if (tickCount % 50 === 0) {
        saveAllToDisk();
    }
}, 100);

// Co-op Sync Endpoint (Gorilla Gods + NPCs + World Count)
app.post('/api/coop/sync', (req, res) => {
    const now = Date.now();
    for (const id of Object.keys(activeGods)) {
        if (now - activeGods[id].lastSeen > 6000) delete activeGods[id];
    }

    const { id, x, y, z, rotY, isFlying } = req.body || {};
    if (id) {
        if (!activeGods[id]) {
            const currentIds = Object.keys(activeGods);
            if (currentIds.length < 4) {
                const usedSlots = currentIds.map(k => activeGods[k].slot);
                let slot = 1;
                while (usedSlots.includes(slot) && slot <= 4) slot++;
                activeGods[id] = {
                    id,
                    slot,
                    name: 'Gorilla God ' + slot,
                    color: GOD_COLORS[(slot - 1) % 4],
                    x: x || 0,
                    y: y || 0,
                    z: z || 20,
                    rotY: rotY || 0,
                    isFlying: !!isFlying,
                    lastSeen: now
                };
            }
        } else {
            if (typeof x === 'number') activeGods[id].x = x;
            if (typeof y === 'number') activeGods[id].y = y;
            if (typeof z === 'number') activeGods[id].z = z;
            if (typeof rotY === 'number') activeGods[id].rotY = rotY;
            activeGods[id].isFlying = !!isFlying;
            activeGods[id].lastSeen = now;
        }
    }

    res.json({
        gods: Object.values(activeGods),
        npcs: npcs,
        worldCount: worldItems.length
    });
});

// Get Full World & NPCs
app.get('/api/world', (req, res) => {
    res.json({ items: worldItems, npcs: npcs });
});

// Save World Items
app.post('/api/world', (req, res) => {
    if (Array.isArray(req.body)) {
        worldItems = req.body;
        saveAllToDisk();
        return res.json({ success: true, count: worldItems.length });
    }
    res.status(400).json({ error: 'Expected array' });
});

// Auto-Restore Backup After Ephemeral Render Restart
app.post('/api/world/rehydrate', (req, res) => {
    const { items, savedNpcs } = req.body || {};
    let restored = false;
    if (worldItems.length === 0 && Array.isArray(items) && items.length > 0) {
        worldItems = items;
        restored = true;
    }
    if (Array.isArray(savedNpcs) && savedNpcs.length > 0 && npcs.length <= 1) {
        npcs = savedNpcs;
        restored = true;
    }
    if (restored) saveAllToDisk();
    res.json({ success: true, restored, worldCount: worldItems.length, npcCount: npcs.length });
});

// Update Single World Piece (Door, Inventory, Bed Owner, Merchant Shop)
app.post('/api/world/update-item', (req, res) => {
    const { id, isOpen, inventory, assignedTo, merchantSkin, shopItems, merchantName } = req.body || {};
    const target = worldItems.find(it => it.id === id);
    if (!target) return res.status(404).json({ error: 'Item not found' });

    if (typeof isOpen === 'boolean') target.isOpen = isOpen;
    if (Array.isArray(inventory)) target.inventory = inventory.slice(0, 10);
    if (assignedTo !== undefined) {
        target.assignedTo = assignedTo;
        const foundNpc = npcs.find(n => n.name === assignedTo || n.id === assignedTo);
        if (foundNpc) {
            foundNpc.assignedBedId = target.id;
            addDiary(foundNpc, 'The Gorilla Gods assigned me my very own bed!');
            addLog(foundNpc, 'Assigned to bed at (' + target.x + ', ' + target.z + ').');
        }
    }
    if (typeof merchantSkin === 'number') target.merchantSkin = merchantSkin;
    if (Array.isArray(shopItems)) target.shopItems = shopItems;
    if (typeof merchantName === 'string') target.merchantName = merchantName;

    saveAllToDisk();
    res.json({ success: true, item: target, npcs });
});

// Spawn New Companion Animal (20 Cute Anime Animals)
app.post('/api/npcs/spawn', (req, res) => {
    const { name, species, x, z } = req.body || {};
    if (!name || !species) return res.status(400).json({ error: 'Name and species required' });

    const newCompanion = {
        id: 'npc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: name.trim(),
        species,
        x: typeof x === 'number' ? x : 0,
        z: typeof z === 'number' ? z : 10,
        rotY: 0,
        targetX: (typeof x === 'number' ? x : 0) + 10,
        targetZ: (typeof z === 'number' ? z : 10) + 10,
        mood: 'Excited 🎉',
        hunger: 90,
        energy: 95,
        activity: 'Exploring Town',
        assignedBedId: null,
        wants: ['Make friends with Peanut 🐼', 'Get a treat from a Merchant 🏪', 'Find a cozy bed 🛌'],
        diary: ['Dear Diary: Today I arrived in The Badabing! Everyone has such cute anime eyes!'],
        activityLog: ['[' + new Date().toLocaleTimeString() + '] Spawned as a cute ' + species + '!']
    };
    npcs.push(newCompanion);
    saveAllToDisk();
    res.json({ success: true, companion: newCompanion, npcs });
});

// Feed, Energize, or Buy Merchant Item for Companion
app.post('/api/npcs/action', (req, res) => {
    const { npcId, actionType, itemName, itemPrice } = req.body || {};
    const npc = npcs.find(n => n.id === npcId) || npcs[0];
    if (!npc) return res.status(404).json({ error: 'NPC not found' });

    if (actionType === 'feed') {
        npc.hunger = 100;
        npc.mood = 'Stuffed & Happy 🍔';
        npc.activity = 'Enjoying a Meal';
        addLog(npc, 'Fed a delicious meal by a Gorilla God.');
    } else if (actionType === 'rest') {
        npc.energy = 100;
        npc.mood = 'Super Charged ⚡';
        npc.activity = 'Doing Zoomies';
        addLog(npc, 'Energized by a Gorilla God.');
    } else if (actionType === 'cheer') {
        npc.mood = 'Loved ❤️';
        npc.activity = 'Happy Anime Dance';
        addDiary(npc, 'Got head pats from a Gorilla God today!');
        addLog(npc, 'Cheered up by a Gorilla God.');
    } else if (actionType === 'buy') {
        npc.hunger = Math.min(100, npc.hunger + 35);
        npc.energy = Math.min(100, npc.energy + 25);
        npc.mood = 'Spoiled & Joyful 🛍️';
        npc.activity = 'Using ' + (itemName || 'Gift');
        addDiary(npc, 'Someone bought me ' + (itemName || 'a gift') + ' for $' + (itemPrice || 0) + ' at the Merchant!');
        addLog(npc, 'Received ' + (itemName || 'item') + ' ($' + (itemPrice || 0) + ') from Merchant.');
        npc.wants = ['Enjoy my new ' + (itemName || 'treat') + ' ✨', 'Take a happy nap 🛌', 'Explore new buildings 🏢'];
    }

    saveAllToDisk();
    res.json({ success: true, npc, npcs });
});

app.use((req, res) => {
    const rootIndex = path.join(__dirname, 'index.html');
    const publicIndex = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
    if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
    res.status(404).send('index.html not found');
});

app.listen(PORT, () => {
    console.log('The Badabing Server running on port ' + PORT);
});
