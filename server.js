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
    try { worldItems = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'); } catch (e) { worldItems = []; }
}

function createDefaultPeanut() {
    return {
        id: 'peanut',
        name: 'Peanut',
        species: 'panda',
        x: 6,
        z: 14,
        rotY: 0,
        targetX: 20,
        targetZ: 18,
        lastProgressDist: 999,
        stallTicks: 0,
        waveUntil: 0,
        wallet: 250,
        inventory: ['🎋 Fresh Bamboo', '🥪 Deli Sub', '📖 Master Chef Cooking Vol. 1'],
        mood: 'Happy ✨',
        hunger: 88,
        energy: 92,
        activity: 'Roaming Town',
        assignedBedId: null,
        wants: ['Grow crops on a Farm Plot 🌱', 'Visit the Italian Deli 🥪', 'Wave at a Player 👋'],
        diary: [
            'Dear Diary: The new Fortnite-style lighting and day/night sky look amazing!',
            'Ready to plant, water, and harvest crops whenever a Gorilla God assigns me a Farm Plot!'
        ],
        activityLog: ['[' + new Date().toLocaleTimeString() + '] Roaming town freely.']
    };
}

let npcs = [];
if (fs.existsSync(NPC_FILE)) {
    try { npcs = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8') || '[]'); } catch (e) { npcs = []; }
}
if (!Array.isArray(npcs) || npcs.length === 0) npcs = [createDefaultPeanut()];

function saveAllToDisk() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(worldItems, null, 2), 'utf8');
        fs.writeFileSync(NPC_FILE, JSON.stringify(npcs, null, 2), 'utf8');
    } catch (e) { console.error('Disk save error:', e.message); }
}

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

// Generous Bounding-Box Obstacle Check so Companions Never Clip or Loop on Structures
const BUILDING_BOUNDS = {
    wall: [2.2, 0.6], window: [2.2, 0.6], fence: [2.2, 0.6], doorway: [2.2, 0.6],
    mcdonalds: [9.2, 7.2], hobby_store: [9.2, 7.2], deli: [9.2, 7.2], library: [9.2, 7.2], gym: [9.2, 7.2],
    walmart: [13.2, 10.2], mechanic_shop: [11.2, 9.2], watch_tower: [3.6, 3.6],
    fountain: [4.2, 4.2], gorilla_statue: [4.5, 4.5], pond: [9.5, 7.5],
    swimming_pool: [9.8, 6.8], ice_rink: [12.5, 8.5],
    basketball_court: [15.0, 10.0], tennis_court: [14.0, 8.0], soccer_court: [18.0, 12.0],
    arcade: [1.8, 1.8], locker: [1.8, 1.8], computer_desk: [2.0, 1.8], merchant: [2.8, 2.4],
    farm_plot: [2.6, 2.6], portal: [2.6, 1.8], bed: [2.0, 2.4], mailbox: [1.4, 1.4], sign_post: [2.0, 1.0]
};

function isNpcBlockedByWall(nx, nz, ignoreItemId) {
    const pad = 1.6;
    for (let i = 0; i < worldItems.length; i++) {
        const it = worldItems[i];
        if (it.id === ignoreItemId) continue;
        if ((it.y || 0) > 2.5 || it.type === 'foundation' || it.type === 'roof_flat' || it.type === 'roof_pitched') continue;
        if (it.type === 'doorway' && it.isOpen) continue;

        const b = BUILDING_BOUNDS[it.type] || [2.2, 2.2];
        const dx = nx - it.x;
        const dz = nz - it.z;
        const rad = -((it.rot || 0) * Math.PI) / 180;
        const lx = dx * Math.cos(rad) - dz * Math.sin(rad);
        const lz = dx * Math.sin(rad) + dz * Math.cos(rad);

        if (Math.abs(lx) < b[0] + pad && Math.abs(lz) < b[1] + pad) return true;
    }
    return false;
}

// Raycasts 8 steps along a path to guarantee no building sits between companion and target
function isPathClear(x1, z1, x2, z2, ignoreItemId) {
    const steps = 8;
    for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const px = x1 + (x2 - x1) * t;
        const pz = z1 + (z2 - z1) * t;
        if (isNpcBlockedByWall(px, pz, ignoreItemId)) return false;
    }
    return true;
}

function pickRandomRoamWaypoint(npc) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 38;
        const tx = +(npc.x + Math.cos(angle) * dist).toFixed(1);
        const tz = +(npc.z + Math.sin(angle) * dist).toFixed(1);
        const clampedX = Math.max(-140, Math.min(140, tx));
        const clampedZ = Math.max(-140, Math.min(140, tz));
        if (!isNpcBlockedByWall(clampedX, clampedZ) && isPathClear(npc.x, npc.z, clampedX, clampedZ)) {
            npc.targetX = clampedX;
            npc.targetZ = clampedZ;
            npc.stallTicks = 0;
            npc.lastProgressDist = Math.hypot(clampedX - npc.x, clampedZ - npc.z);
            return;
        }
    }
    // Fallback: step gently toward open town road (X: 0, Z: 0)
    npc.targetX = 0;
    npc.targetZ = 0;
    npc.stallTicks = 0;
    npc.lastProgressDist = Math.hypot(npc.x, npc.z);
}

// Escape check on startup in case any companion was saved inside a structure
npcs.forEach(n => {
    if (typeof n.wallet !== 'number') n.wallet = 200;
    if (!Array.isArray(n.inventory)) n.inventory = ['🍎 Sweet Apple'];
    if (typeof n.x !== 'number' || isNaN(n.x)) n.x = 6;
    if (typeof n.z !== 'number' || isNaN(n.z)) n.z = 14;
    if (isNpcBlockedByWall(n.x, n.z)) {
        for (let r = 4; r <= 40; r += 4) {
            let escaped = false;
            for (let a = 0; a < 8; a++) {
                const tx = +(n.x + Math.cos((a * Math.PI) / 4) * r).toFixed(1);
                const tz = +(n.z + Math.sin((a * Math.PI) / 4) * r).toFixed(1);
                if (!isNpcBlockedByWall(tx, tz)) {
                    n.x = tx; n.z = tz; escaped = true; break;
                }
            }
            if (escaped) break;
        }
    }
    pickRandomRoamWaypoint(n);
});

const CROP_REWARDS = {
    '🍅 Slurp Tomatoes': 35,
    '🌽 Golden Corn': 40,
    '🥕 Crunchy Carrots': 30,
    '🍓 Shield Berries': 50,
    '🎃 Mythic Pumpkins': 75
};

const activePlayers = {};
const GOD_COLORS = ['#fa9549', '#38bdf8', '#4ade80', '#c084fc'];
let sportsScores = { hoops: 0, goals: 0, rallies: 0 };

let tickCount = 0;
const STEER_ANGLES = [0, 0.35, -0.35, 0.75, -0.75, 1.25, -1.25, 1.85, -1.85, Math.PI];

// Main Server Simulation Tick (100ms) — Handles 3-Min Farming Cycle & Smooth Unstuck Roaming
setInterval(() => {
    tickCount++;
    const now = Date.now();

    // 1. Update All Active Farm Plots (3-Minute Total Completion = 90s Water 1 + 90s Water 2)
    worldItems.forEach(plot => {
        if (plot.type !== 'farm_plot') return;
        if (!plot.farmState) {
            plot.farmState = {
                assignedNpcId: 'peanut',
                cropType: '🍅 Slurp Tomatoes',
                loopsRemaining: 0,
                stage: 'idle',
                waterCount: 0,
                stageStartedAt: 0,
                progressPct: 0
            };
        }
        const fsState = plot.farmState;
        if (fsState.stage === 'growing_1') {
            const elapsed = now - (fsState.stageStartedAt || now);
            fsState.progressPct = Math.min(50, Math.round((elapsed / 90000) * 50));
            // 90 seconds after first watering -> requires second watering!
            if (elapsed >= 90000) {
                fsState.stage = 'needs_water_2';
            }
        } else if (fsState.stage === 'growing_2') {
            const elapsed = now - (fsState.stageStartedAt || now);
            fsState.progressPct = Math.min(100, 50 + Math.round((elapsed / 90000) * 50));
            // 90 seconds after second watering (180s / 3 mins total) -> ready to harvest!
            if (elapsed >= 90000) {
                fsState.stage = 'ready_harvest';
                fsState.progressPct = 100;
            }
        }
    });

    // 2. Update All Companions (Peanut + Spawned Peers)
    npcs.forEach((npc) => {
        npc.hunger = Math.max(10, +(npc.hunger - 0.008).toFixed(2));
        npc.energy = Math.max(10, +(npc.energy - 0.006).toFixed(2));
        if (tickCount % 300 === 0) npc.wallet = (npc.wallet || 0) + 5;

        if (npc.waveUntil && now < npc.waveUntil) {
            npc.activity = 'Waving Back! 👋';
            return;
        }

        // Check if this companion has an active Farm Plot needing action right now
        const urgentPlot = worldItems.find(it =>
            it.type === 'farm_plot' &&
            it.farmState &&
            it.farmState.assignedNpcId === npc.id &&
            it.farmState.loopsRemaining > 0 &&
            ['needs_planting', 'needs_water_1', 'needs_water_2', 'ready_harvest'].includes(it.farmState.stage)
        );

        let destX = npc.targetX;
        let destZ = npc.targetZ;
        let ignoreId = null;

        if (urgentPlot) {
            const fsState = urgentPlot.farmState;
            ignoreId = urgentPlot.id;
            destX = urgentPlot.x;
            destZ = urgentPlot.z + 2.8;
            const labelMap = {
                needs_planting: 'Planting ' + fsState.cropType + ' 🌱',
                needs_water_1: 'Watering Crop (1/2) 💧',
                needs_water_2: 'Watering Crop (2/2) 💦',
                ready_harvest: 'Harvesting ' + fsState.cropType + ' 🌾'
            };
            npc.activity = labelMap[fsState.stage] || 'Farming 🌱';
            npc.mood = 'Hardworking Farmer 🌾';
        } else {
            const distToTarget = Math.hypot((destX || 0) - npc.x, (destZ || 0) - npc.z);
            if (typeof destX !== 'number' || typeof destZ !== 'number' || isNaN(distToTarget) || distToTarget < 1.8) {
                pickRandomRoamWaypoint(npc);
                destX = npc.targetX;
                destZ = npc.targetZ;
            }
            // Show growing status if they are waiting on a crop, while still letting them roam freely
            const growingPlot = worldItems.find(it =>
                it.type === 'farm_plot' &&
                it.farmState &&
                it.farmState.assignedNpcId === npc.id &&
                it.farmState.loopsRemaining > 0 &&
                ['growing_1', 'growing_2'].includes(it.farmState.stage)
            );
            if (growingPlot) {
                npc.activity = `Tending ${growingPlot.farmState.cropType} (${growingPlot.farmState.progressPct}% Grown • Loops: ${growingPlot.farmState.loopsRemaining})`;
            } else {
                npc.activity = 'Roaming Town ✨';
            }
            npc.mood = (npc.hunger > 50 && npc.energy > 50) ? 'Happy ✨' : 'Chill 🐾';
        }

        const dx = destX - npc.x;
        const dz = destZ - npc.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.9) {
            const baseAngle = Math.atan2(dx, dz);
            const speed = 0.22;
            let moved = false;

            // If currently trapped inside a newly placed structure, walk straight out
            const trappedInside = isNpcBlockedByWall(npc.x, npc.z, ignoreId);

            for (let a = 0; a < STEER_ANGLES.length; a++) {
                const tryAngle = baseAngle + STEER_ANGLES[a];
                const stepX = npc.x + Math.sin(tryAngle) * speed;
                const stepZ = npc.z + Math.cos(tryAngle) * speed;

                if (trappedInside || !isNpcBlockedByWall(stepX, stepZ, ignoreId)) {
                    npc.x = +stepX.toFixed(2);
                    npc.z = +stepZ.toFixed(2);
                    // Smooth server-side angle update
                    npc.rotY = +tryAngle.toFixed(2);
                    moved = true;
                    break;
                }
            }

            // Progress Watchdog: if distance to target hasn't improved by at least 0.15m, count stall tick
            if (typeof npc.lastProgressDist === 'number' && dist >= npc.lastProgressDist - 0.05) {
                npc.stallTicks = (npc.stallTicks || 0) + 1;
            } else {
                npc.stallTicks = 0;
                npc.lastProgressDist = dist;
            }

            if (!moved || npc.stallTicks > 15) {
                if (urgentPlot) {
                    // Snap directly to farm plot edge so a wall never blocks farming completion
                    npc.x = urgentPlot.x;
                    npc.z = urgentPlot.z + 2.8;
                    npc.stallTicks = 0;
                } else {
                    // Immediately abandon unreachable waypoint and pick a new clear one
                    pickRandomRoamWaypoint(npc);
                }
            }
        } else {
            // Reached destination! Handle Farming Stage Transitions
            if (urgentPlot) {
                const fsState = urgentPlot.farmState;
                npc.rotY = +(Math.atan2(urgentPlot.x - npc.x, urgentPlot.z - npc.z)).toFixed(2);
                if (fsState.stage === 'needs_planting') {
                    fsState.stage = 'needs_water_1';
                    fsState.waterCount = 0;
                    fsState.progressPct = 5;
                    addLog(npc, 'Planted ' + fsState.cropType + ' seeds.');
                } else if (fsState.stage === 'needs_water_1') {
                    fsState.stage = 'growing_1';
                    fsState.waterCount = 1;
                    fsState.stageStartedAt = now;
                    addLog(npc, 'Watered ' + fsState.cropType + ' (1/2). Next water in 90s!');
                    pickRandomRoamWaypoint(npc);
                } else if (fsState.stage === 'needs_water_2') {
                    fsState.stage = 'growing_2';
                    fsState.waterCount = 2;
                    fsState.stageStartedAt = now;
                    addLog(npc, 'Watered ' + fsState.cropType + ' (2/2). Harvest in 90s!');
                    pickRandomRoamWaypoint(npc);
                } else if (fsState.stage === 'ready_harvest') {
                    const reward = CROP_REWARDS[fsState.cropType] || 35;
                    npc.inventory.push(fsState.cropType);
                    npc.wallet = (npc.wallet || 0) + reward;
                    fsState.loopsRemaining = Math.max(0, (fsState.loopsRemaining || 1) - 1);
                    addLog(npc, `Harvested ${fsState.cropType}! (+$${reward}, Loops left: ${fsState.loopsRemaining})`);
                    addDiary(npc, `Harvested fresh ${fsState.cropType} from the farm!`);

                    if (fsState.loopsRemaining > 0) {
                        fsState.stage = 'needs_planting';
                        fsState.waterCount = 0;
                        fsState.progressPct = 0;
                    } else {
                        fsState.stage = 'idle';
                        fsState.waterCount = 0;
                        fsState.progressPct = 0;
                        pickRandomRoamWaypoint(npc);
                    }
                    saveAllToDisk();
                }
            } else {
                pickRandomRoamWaypoint(npc);
            }
        }
    });

    if (tickCount % 50 === 0) saveAllToDisk();
}, 100);

app.post('/api/coop/sync', (req, res) => {
    const now = Date.now();
    for (const id of Object.keys(activePlayers)) {
        if (now - activePlayers[id].lastSeen > 6000) delete activePlayers[id];
    }

    const { id, x, y, z, rotY, isFlying, isGod, customName } = req.body || {};
    if (id) {
        if (!activePlayers[id]) {
            const currentPlayers = Object.values(activePlayers);
            const currentGods = currentPlayers.filter(p => p.isGod);
            const allowGod = !!isGod && currentGods.length < 4;
            const slot = (currentPlayers.length % 4) + 1;
            activePlayers[id] = {
                id, slot, isGod: allowGod,
                name: allowGod ? (customName || ('Gorilla God ' + (currentGods.length + 1))) : ('Visitor ' + slot),
                color: allowGod ? GOD_COLORS[currentGods.length % 4] : '#fde047',
                x: x || 0, y: y || 0, z: z || 20, rotY: rotY || 0, isFlying: !!isFlying, lastSeen: now
            };
        } else {
            const p = activePlayers[id];
            if (typeof x === 'number') p.x = x;
            if (typeof y === 'number') p.y = y;
            if (typeof z === 'number') p.z = z;
            if (typeof rotY === 'number') p.rotY = rotY;
            p.isFlying = !!isFlying;
            if (isGod && !p.isGod) {
                const currentGods = Object.values(activePlayers).filter(pl => pl.isGod);
                if (currentGods.length < 4) {
                    p.isGod = true;
                    p.name = customName || ('Gorilla God ' + (currentGods.length + 1));
                    p.color = GOD_COLORS[currentGods.length % 4];
                }
            } else if (!isGod && p.isGod) {
                p.isGod = false;
                p.name = 'Visitor ' + p.slot;
                p.color = '#fde047';
            } else if (isGod && customName && p.name !== customName) {
                p.name = customName;
            }
            p.lastSeen = now;
        }
    }

    const farmStates = worldItems
        .filter(it => it.type === 'farm_plot')
        .map(it => ({ id: it.id, farmState: it.farmState }));

    res.json({
        gods: Object.values(activePlayers),
        npcs,
        worldCount: worldItems.length,
        sportsScores,
        farmStates,
        serverTimeMs: now
    });
});

app.post('/api/sports/score', (req, res) => {
    const { sport } = req.body || {};
    if (sport === 'basketball') sportsScores.hoops++;
    if (sport === 'soccer') sportsScores.goals++;
    if (sport === 'tennis') sportsScores.rallies++;
    res.json({ success: true, sportsScores });
});

app.get('/api/world', (req, res) => {
    res.json({ items: worldItems, npcs, sportsScores });
});

app.post('/api/world', (req, res) => {
    if (Array.isArray(req.body)) {
        worldItems = req.body;
        saveAllToDisk();
        return res.json({ success: true, count: worldItems.length });
    }
    res.status(400).json({ error: 'Expected array' });
});

app.post('/api/world/rehydrate', (req, res) => {
    const { items, savedNpcs, forceNpcs } = req.body || {};
    let restored = false;
    if (worldItems.length === 0 && Array.isArray(items) && items.length > 0) {
        worldItems = items;
        restored = true;
    }
    if (Array.isArray(savedNpcs) && savedNpcs.length > 0 && (forceNpcs || npcs.length <= 1)) {
        npcs = savedNpcs;
        restored = true;
    }
    if (restored) saveAllToDisk();
    res.json({ success: true, restored, worldCount: worldItems.length, npcCount: npcs.length, npcs });
});

app.post('/api/world/update-item', (req, res) => {
    const { id, isOpen, inventory, assignedTo, merchantSkin, shopItems, merchantName, signText, signColor, signBg, lastUrl, farmConfig } = req.body || {};
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
        }
    }
    if (typeof merchantSkin === 'number') target.merchantSkin = merchantSkin;
    if (Array.isArray(shopItems)) target.shopItems = shopItems;
    if (typeof merchantName === 'string') target.merchantName = merchantName;
    if (typeof signText === 'string') target.signText = signText;
    if (typeof signColor === 'string') target.signColor = signColor;
    if (typeof signBg === 'string') target.signBg = signBg;
    if (typeof lastUrl === 'string') target.lastUrl = lastUrl;

    // God Farm Plot Assignment (Starts 3-Minute Two-Watering Loop)
    if (farmConfig && target.type === 'farm_plot') {
        target.farmState = {
            assignedNpcId: farmConfig.assignedNpcId || 'peanut',
            cropType: farmConfig.cropType || '🍅 Slurp Tomatoes',
            loopsRemaining: Number(farmConfig.loops) || 1,
            stage: (Number(farmConfig.loops) || 0) > 0 ? 'needs_planting' : 'idle',
            waterCount: 0,
            stageStartedAt: Date.now(),
            progressPct: 0
        };
        const farmer = npcs.find(n => n.id === target.farmState.assignedNpcId);
        if (farmer && target.farmState.loopsRemaining > 0) {
            addLog(farmer, `Assigned to farm ${target.farmState.cropType} (${target.farmState.loopsRemaining} loops).`);
            addDiary(farmer, `I'm in charge of growing ${target.farmState.cropType} on the farm!`);
        }
    }

    saveAllToDisk();
    res.json({ success: true, item: target, npcs });
});

app.post('/api/npcs/spawn', (req, res) => {
    const { name, species, x, z } = req.body || {};
    if (!name || !species) return res.status(400).json({ error: 'Name and species required' });

    const startX = typeof x === 'number' ? x : 6;
    const startZ = typeof z === 'number' ? z : 12;
    const newCompanion = {
        id: 'npc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: name.trim(),
        species,
        x: startX,
        z: startZ,
        rotY: 0,
        targetX: startX + 14,
        targetZ: startZ - 14,
        lastProgressDist: 20,
        stallTicks: 0,
        waveUntil: 0,
        wallet: 200,
        inventory: ['🍎 Welcome Apple'],
        mood: 'Excited 🎉',
        hunger: 90,
        energy: 95,
        activity: 'Roaming Town',
        assignedBedId: null,
        wants: ['Help farm crops 🌱', 'Wave at Visitors 👋', 'Explore Town ✨'],
        diary: ['Dear Diary: Arrived in The Badabing!'],
        activityLog: ['[' + new Date().toLocaleTimeString() + '] Spawned as a ' + species + '!']
    };
    pickRandomRoamWaypoint(newCompanion);
    npcs.push(newCompanion);
    saveAllToDisk();
    res.json({ success: true, companion: newCompanion, npcs });
});

app.post('/api/npcs/delete', (req, res) => {
    const { id } = req.body || {};
    if (!id || id === 'peanut') return res.status(400).json({ error: 'Peanut cannot be deleted!' });
    npcs = npcs.filter(n => n.id !== id);
    saveAllToDisk();
    res.json({ success: true, npcs });
});

app.post('/api/npcs/action', (req, res) => {
    const { npcId, actionType, itemName, itemPrice, slotIndex, amount, playerX, playerZ } = req.body || {};
    const npc = npcs.find(n => n.id === npcId) || npcs[0];
    if (!npc) return res.status(404).json({ error: 'NPC not found' });

    if (typeof npc.wallet !== 'number') npc.wallet = 200;
    if (!Array.isArray(npc.inventory)) npc.inventory = [];

    if (actionType === 'wave') {
        npc.waveUntil = Date.now() + 1200;
        npc.mood = 'Overjoyed 👋✨';
        npc.activity = 'Waving Back! 👋';
        if (typeof playerX === 'number' && typeof playerZ === 'number') {
            npc.rotY = +(Math.atan2(playerX - npc.x, playerZ - npc.z)).toFixed(2);
        }
        addLog(npc, 'Waved back at a friendly player!');
    } else if (actionType === 'add_book') {
        npc.inventory.push(itemName || '📖 Recipe Cooking Book');
        addDiary(npc, 'Checked out "' + (itemName || 'Cooking Book') + '" from the library!');
    } else if (actionType === 'feed') {
        npc.hunger = 100; npc.mood = 'Stuffed & Happy 🍔';
    } else if (actionType === 'rest') {
        npc.energy = 100; npc.mood = 'Super Charged ⚡';
    } else if (actionType === 'cheer') {
        npc.mood = 'Loved ❤️';
    } else if (actionType === 'add_funds') {
        npc.wallet += (Number(amount) || 50);
    } else if (actionType === 'use_item') {
        const idx = Number(slotIndex);
        if (idx >= 0 && idx < npc.inventory.length) {
            const used = npc.inventory.splice(idx, 1)[0];
            npc.hunger = Math.min(100, npc.hunger + 30);
            npc.energy = Math.min(100, npc.energy + 25);
            npc.mood = 'Delighted 🌟';
            addLog(npc, 'Used ' + used + ' from bag.');
        }
    } else if (actionType === 'buy') {
        const price = Number(itemPrice) || 0;
        if (npc.wallet < price) return res.status(400).json({ error: 'Not enough funds in wallet!' });
        npc.wallet -= price;
        npc.inventory.push(itemName || '🎁 Gift');
        npc.mood = 'Spoiled & Joyful 🛍️';
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

app.listen(PORT, () => console.log('The Badabing Server running on port ' + PORT));
