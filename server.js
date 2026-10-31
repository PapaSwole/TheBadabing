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
        x: 6,
        z: 14,
        rotY: 0,
        targetX: 22,
        targetZ: -18,
        stuckTicks: 0,
        wavingUntil: 0,
        wallet: 250,
        inventory: ['🎋 Fresh Bamboo', '🥪 Deli Sub', '🥤 Fizzy Soda'],
        mood: 'Happy ✨',
        hunger: 88,
        energy: 92,
        activity: 'Roaming Town',
        assignedBedId: null,
        wants: ['Wave to a Visitor or Gorilla God 👋', 'Visit the new Deli & Hobby Store 🥪', 'Play Basketball, Tennis, or Soccer ⚽'],
        diary: [
            'Dear Diary: Woke up feeling super cute in The Badabing!',
            'Visitors float around as little halos until they unlock Gorilla God mode!'
        ],
        activityLog: [
            '[' + new Date().toLocaleTimeString() + '] Started roaming around town.'
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

npcs.forEach(n => {
    if (typeof n.wallet !== 'number') n.wallet = 200;
    if (!Array.isArray(n.inventory)) n.inventory = ['🍎 Sweet Apple', '🧃 Juice Box'];
    if (typeof n.x !== 'number' || isNaN(n.x)) n.x = 6;
    if (typeof n.z !== 'number' || isNaN(n.z)) n.z = 14;
    if (typeof n.targetX !== 'number' || isNaN(n.targetX)) n.targetX = n.x + 18;
    if (typeof n.targetZ !== 'number' || isNaN(n.targetZ)) n.targetZ = n.z - 18;
    n.stuckTicks = 0;
    n.wavingUntil = n.wavingUntil || 0;
});

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

// Companion Obstacle Collision Check (Includes Hobby Store, Deli, Pond, Courts)
function isNpcBlockedByWall(nx, nz) {
    const pad = 0.65;
    for (let i = 0; i < worldItems.length; i++) {
        const it = worldItems[i];
        if ((it.y || 0) > 2.2) continue;

        const dx = nx - it.x;
        const dz = nz - it.z;
        const rad = -((it.rot || 0) * Math.PI) / 180;
        const lx = dx * Math
