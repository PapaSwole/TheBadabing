const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'world_data.json');
const NPC_FILE = path.join(__dirname, 'npc_data.json');
const TYCOON_FILE = path.join(__dirname, 'tycoon_data.json');

app.use(express.json({ limit: '25mb' }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

let worldRev = Date.now();

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
        assignedOfficeId: null,
        wallet: 250,
        inventory: ['🎋 Fresh Bamboo', '🥪 Deli Sub', '📖 Master Chef Cooking Vol. 1'],
        mood: 'Happy ✨',
        hunger: 88,
        energy: 92,
        activity: 'Roaming Town',
        assignedBedId: null,
        wants: ['Work 10AM-4PM at the Office Tower 🏢', 'Grow crops on a Farm Plot 🌱', 'Wave at a Player 👋'],
        diary: [
            'Dear Diary: The new 3-story Office Tower has cubicles, a boardroom, and a Secretary!',
            'If assigned to the Office, I work 10:00 AM to 4:00 PM EST and earn salary!'
        ],
        activityLog: ['[' + new Date().toLocaleTimeString() + '] Roaming town freely.']
    };
}

let npcs = [];
if (fs.existsSync(NPC_FILE)) {
    try { npcs = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8') || '[]'); } catch (e) { npcs = []; }
}
if (!Array.isArray(npcs) || npcs.length === 0) npcs = [createDefaultPeanut()];

function createDefaultTycoon() {
    return {
        walletCash: 50,
        storedCollectorCash: 0,
        unlockedPads: { dropper1: true, speed: false, upgrader: false, megaDropper: false, tower: false },
        rev: Date.now()
    };
}

let tycoonState = createDefaultTycoon();
if (fs.existsSync(TYCOON_FILE)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(TYCOON_FILE, 'utf8') || '{}');
        if (typeof loaded.walletCash === 'number') tycoonState = Object.assign(createDefaultTycoon(), loaded);
    } catch (e) {}
}

function saveAllToDisk() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(worldItems, null, 2), 'utf8');
        fs.writeFileSync(NPC_FILE, JSON.stringify(npcs, null, 2), 'utf8');
        fs.writeFileSync(TYCOON_FILE, JSON.stringify(tycoonState, null, 2), 'utf8');
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

// Get Current Real-Time EST Hour (0 - 23) for 10 AM - 4 PM Office Work Shift
const estHourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: 'numeric'
});
function getCurrentEstHour() {
    try {
        const parts = estHourFormatter.formatToParts(new Date());
        const hrPart = parts.find(p => p.type === 'hour');
        return hrPart ? (Number(hrPart.value) % 24) : 12;
    } catch (e) {
        return 12;
    }
}

const BUILDING_BOUNDS = {
    wall: [2.6, 0.7], window: [2.6, 0.7], fence: [2.6, 0.7], doorway: [2.6, 0.7],
    mcdonalds: [10.5, 8.2], hobby_store: [10.5, 8.2], deli: [10.5, 8.2], library: [10.5, 8.2], gym: [10.5, 8.2],
    walmart: [15.5, 11.8], mechanic_shop: [13.0, 10.5], office_building: [16.5, 13.5], watch_tower: [4.2, 4.2],
    fountain: [4.8, 4.8], gorilla_statue: [5.0, 5.0], pond: [11.0, 8.8],
    swimming_pool: [11.5, 7.8], ice_rink: [14.2, 9.8],
    basketball_court: [17.5, 11.5], tennis_court: [16.5, 9.5], soccer_court: [21.0, 14.0],
    arcade: [2.0, 2.0], locker: [2.0, 2.0], computer_desk: [2.2, 2.0], merchant: [3.2, 2.8],
    farm_plot: [3.0, 3.0], portal: [3.0, 2.0], bed: [2.4, 2.8], mailbox: [1.6, 1.6], sign_post: [2.4, 1.2]
};

function isNpcBlockedByWall(nx, nz, ignoreItemId) {
    const pad = 1.6;
    for (let i = 0; i < worldItems.length; i++) {
        const it = worldItems[i];
        if (it.id === ignoreItemId) continue;
        if ((it.y || 0) > 2.5 || it.type === 'foundation' || it.type === 'roof_flat' || it.type === 'roof_pitched') continue;
        if (it.type === 'doorway' && it.isOpen) continue;

        const b = BUILDING_BOUNDS[it.type] || [2.4, 2.4];
        const dx = nx - it.x;
        const dz = nz - it.z;
        const rad = -((it.rot || 0) * Math.PI) / 180;
        const lx = dx * Math.cos(rad) - dz * Math.sin(rad);
        const lz = dx * Math.sin(rad) + dz * Math.cos(rad);

        if (Math.abs(lx) < b[0] + pad && Math.abs(lz) < b[1] + pad) return true;
    }
    return false;
}

function isPathClear(x1, z1, x2, z2, ignoreItemId) {
    const steps = 8;
    for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        if (isNpcBlockedByWall(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, ignoreItemId)) return false;
    }
    return true;
}

function pickRandomRoamWaypoint(npc) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 38;
        const clampedX = Math.max(-140, Math.min(140, +(npc.x + Math.cos(angle) * dist).toFixed(1)));
        const clampedZ = Math.max(-140, Math.min(140, +(npc.z + Math.sin(angle) * dist).toFixed(1)));
        if (!isNpcBlockedByWall(clampedX, clampedZ) && isPathClear(npc.x, npc.z, clampedX, clampedZ)) {
            npc.targetX = clampedX;
            npc.targetZ = clampedZ;
            npc.stallTicks = 0;
            npc.lastProgressDist = Math.hypot(clampedX - npc.x, clampedZ - npc.z);
            return;
        }
    }
    npc.targetX = 0; npc.targetZ = 0; npc.stallTicks = 0;
    npc.lastProgressDist = Math.hypot(npc.x, npc.z);
}

npcs.forEach(n => {
    if (typeof n.wallet !== 'number') n.wallet = 200;
    if (!Array.isArray(n.inventory)) n.inventory = ['🍎 Sweet Apple'];
    if (typeof n.x !== 'number' || isNaN(n.x)) n.x = 6;
    if (typeof n.z !== 'number' || isNaN(n.z)) n.z = 14;
    pickRandomRoamWaypoint(n);
});

const CROP_REWARDS = {
    '🍅 Slurp Tomatoes': 35, '🌽 Golden Corn': 40, '🥕 Crunchy Carrots': 30, '🍓 Shield Berries': 50, '🎃 Mythic Pumpkins': 75
};
const TYCOON_COSTS = { speed: 50, upgrader: 150, megaDropper: 400, tower: 1000 };
const activePlayers = {};
const GOD_COLORS = ['#fa9549', '#38bdf8', '#4ade80', '#c084fc'];
let sportsScores = { hoops: 0, goals: 0, rallies: 0 };

let tickCount = 0;
const STEER_ANGLES = [0, 0.35, -0.35, 0.75, -0.75, 1.25, -1.25, 1.85, -1.85, Math.PI];

setInterval(() => {
    tickCount++;
    const now = Date.now();
    const estHour = getCurrentEstHour();
    const isOfficeWorkHours = (estHour >= 10 && estHour < 16); // 10:00 AM to 4:00 PM EST

    // 1. Tycoon Income
    const dropTicks = tycoonState.unlockedPads.speed ? 10 : 18;
    if (tickCount % dropTicks === 0) {
        const baseVal = tycoonState.unlockedPads.megaDropper ? 25 : 10;
        const mult = tycoonState.unlockedPads.upgrader ? 3 : 1;
        const towerBonus = tycoonState.unlockedPads.tower ? 50 : 0;
        tycoonState.storedCollectorCash += (baseVal * mult) + towerBonus;
    }

    // 2. Farm Plots (3-Min Total Completion)
    worldItems.forEach(plot => {
        if (plot.type !== 'farm_plot') return;
        if (!plot.farmState) {
            plot.farmState = { assignedNpcId: 'peanut', cropType: '🍅 Slurp Tomatoes', loopsRemaining: 0, stage: 'idle', waterCount: 0, stageStartedAt: 0, progressPct: 0 };
        }
        const fsState = plot.farmState;
        if (fsState.stage === 'growing_1') {
            const elapsed = now - (fsState.stageStartedAt || now);
            fsState.progressPct = Math.min(50, Math.round((elapsed / 90000) * 50));
            if (elapsed >= 90000) fsState.stage = 'needs_water_2';
        } else if (fsState.stage === 'growing_2') {
            const elapsed = now - (fsState.stageStartedAt || now);
            fsState.progressPct = Math.min(100, 50 + Math.round((elapsed / 90000) * 50));
            if (elapsed >= 90000) { fsState.stage = 'ready_harvest'; fsState.progressPct = 100; }
        }
    });

    // 3. Companion AI ( Farming + 10AM-4PM EST Office Work Shift + Roaming )
    npcs.forEach((npc) => {
        npc.hunger = Math.max(10, +(npc.hunger - 0.008).toFixed(2));
        npc.energy = Math.max(10, +(npc.energy - 0.006).toFixed(2));
        if (tickCount % 300 === 0) npc.wallet = (npc.wallet || 0) + 5;

        if (npc.waveUntil && now < npc.waveUntil) {
            npc.activity = 'Waving Back! 👋';
            return;
        }

        const urgentPlot = worldItems.find(it =>
            it.type === 'farm_plot' &&
            it.farmState &&
            it.farmState.assignedNpcId === npc.id &&
            it.farmState.loopsRemaining > 0 &&
            ['needs_planting', 'needs_water_1', 'needs_water_2', 'ready_harvest'].includes(it.farmState.stage)
        );

        // Check if companion is assigned to an Office Building and it is 10 AM - 4 PM EST
        const assignedOffice = worldItems.find(it =>
            it.type === 'office_building' &&
            ((Array.isArray(it.assignedWorkers) && it.assignedWorkers.includes(npc.id)) || npc.assignedOfficeId === it.id)
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
        } else if (assignedOffice && isOfficeWorkHours) {
            // Walk inside the Ground-Floor Office Lobby / Cubicle Area (10:00 AM - 4:00 PM EST)
            ignoreId = assignedOffice.id;
            destX = assignedOffice.x + 3.0;
            destZ = assignedOffice.z - 2.0;
            const distToDesk = Math.hypot(destX - npc.x, destZ - npc.z);
            if (distToDesk <= 1.6) {
                npc.activity = '💼 Working at Office (10AM-4PM Shift)';
                npc.mood = 'Productive Executive 📈';
                if (tickCount % 600 === 0) {
                    npc.wallet = (npc.wallet || 0) + 15;
                    addLog(npc, 'Earned +$15 Office Shift Salary!');
                }
                return;
            } else {
                npc.activity = '🏢 Commuting to Office Shift (10AM-4PM)';
                npc.mood = 'Focused 💼';
            }
        } else {
            const distToTarget = Math.hypot((destX || 0) - npc.x, (destZ || 0) - npc.z);
            if (typeof destX !== 'number' || typeof destZ !== 'number' || isNaN(distToTarget) || distToTarget < 1.8) {
                pickRandomRoamWaypoint(npc);
                destX = npc.targetX;
                destZ = npc.targetZ;
            }
            const growingPlot = worldItems.find(it =>
                it.type === 'farm_plot' && it.farmState && it.farmState.assignedNpcId === npc.id &&
                it.farmState.loopsRemaining > 0 && ['growing_1', 'growing_2'].includes(it.farmState.stage)
            );
            if (growingPlot) {
                npc.activity = `Tending ${growingPlot.farmState.cropType} (${growingPlot.farmState.progressPct}%)`;
            } else if (assignedOffice && !isOfficeWorkHours) {
                npc.activity = 'Off-Duty (Office Shift 10AM-4PM EST)';
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
            const trappedInside = isNpcBlockedByWall(npc.x, npc.z, ignoreId);

            for (let a = 0; a < STEER_ANGLES.length; a++) {
                const tryAngle = baseAngle + STEER_ANGLES[a];
                const stepX = npc.x + Math.sin(tryAngle) * speed;
                const stepZ = npc.z + Math.cos(tryAngle) * speed;

                if (trappedInside || !isNpcBlockedByWall(stepX, stepZ, ignoreId)) {
                    npc.x = +stepX.toFixed(2);
                    npc.z = +stepZ.toFixed(2);
                    npc.rotY = +tryAngle.toFixed(2);
                    moved = true;
                    break;
                }
            }

            if (typeof npc.lastProgressDist === 'number' && dist >= npc.lastProgressDist - 0.05) {
                npc.stallTicks = (npc.stallTicks || 0) + 1;
            } else {
                npc.stallTicks = 0;
                npc.lastProgressDist = dist;
            }

            if (!moved || npc.stallTicks > 15) {
                if (urgentPlot || (assignedOffice && isOfficeWorkHours)) {
                    npc.x = destX;
                    npc.z = destZ;
                    npc.stallTicks = 0;
                } else {
                    pickRandomRoamWaypoint(npc);
                }
            }
        } else {
            if (urgentPlot) {
                const fsState = urgentPlot.farmState;
                npc.rotY = +(Math.atan2(urgentPlot.x - npc.x, urgentPlot.z - npc.z)).toFixed(2);
                if (fsState.stage === 'needs_planting') {
                    fsState.stage = 'needs_water_1'; fsState.waterCount = 0; fsState.progressPct = 5;
                    addLog(npc, 'Planted ' + fsState.cropType + ' seeds.');
                } else if (fsState.stage === 'needs_water_1') {
                    fsState.stage = 'growing_1'; fsState.waterCount = 1; fsState.stageStartedAt = now;
                    addLog(npc, 'Watered ' + fsState.cropType + ' (1/2). Next water in 90s!');
                    pickRandomRoamWaypoint(npc);
                } else if (fsState.stage === 'needs_water_2') {
                    fsState.stage = 'growing_2'; fsState.waterCount = 2; fsState.stageStartedAt = now;
                    addLog(npc, 'Watered ' + fsState.cropType + ' (2/2). Harvest in 90s!');
                    pickRandomRoamWaypoint(npc);
                } else if (fsState.stage === 'ready_harvest') {
                    const reward = CROP_REWARDS[fsState.cropType] || 35;
                    npc.inventory.push(fsState.cropType);
                    npc.wallet = (npc.wallet || 0) + reward;
                    fsState.loopsRemaining = Math.max(0, (fsState.loopsRemaining || 1) - 1);
                    addLog(npc, `Harvested ${fsState.cropType}! (+$${reward})`);
                    if (fsState.loopsRemaining > 0) {
                        fsState.stage = 'needs_planting'; fsState.waterCount = 0; fsState.progressPct = 0;
                    } else {
                        fsState.stage = 'idle'; fsState.waterCount = 0; fsState.progressPct = 0;
                        pickRandomRoamWaypoint(npc);
                    }
                    saveAllToDisk();
                }
            } else if (!assignedOffice || !isOfficeWorkHours) {
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
                p.isGod = false; p.name = 'Visitor ' + p.slot; p.color = '#fde047';
            } else if (isGod && customName && p.name !== customName) {
                p.name = customName;
            }
            p.lastSeen = now;
        }
    }

    const farmStates = worldItems.filter(it => it.type === 'farm_plot').map(it => ({ id: it.id, farmState: it.farmState }));
    res.json({
        gods: Object.values(activePlayers), npcs, worldCount: worldItems.length,
        worldRev, tycoon: tycoonState, sportsScores, farmStates, serverTimeMs: now
    });
});

app.post('/api/tycoon/collect', (req, res) => {
    if (tycoonState.storedCollectorCash > 0) {
        tycoonState.walletCash += tycoonState.storedCollectorCash;
        tycoonState.storedCollectorCash = 0;
        tycoonState.rev = Date.now();
        saveAllToDisk();
    }
    res.json({ success: true, tycoon: tycoonState });
});

app.post('/api/tycoon/unlock', (req, res) => {
    const { padKey } = req.body || {};
    const cost = TYCOON_COSTS[padKey];
    if (!cost) return res.status(400).json({ error: 'Invalid pad' });
    if (!tycoonState.unlockedPads[padKey] && tycoonState.walletCash >= cost) {
        tycoonState.walletCash -= cost;
        tycoonState.unlockedPads[padKey] = true;
        tycoonState.rev = Date.now();
        saveAllToDisk();
    }
    res.json({ success: true, tycoon: tycoonState });
});

app.post('/api/sports/score', (req, res) => {
    const { sport } = req.body || {};
    if (sport === 'basketball') sportsScores.hoops++;
    if (sport === 'soccer') sportsScores.goals++;
    if (sport === 'tennis') sportsScores.rallies++;
    res.json({ success: true, sportsScores });
});

app.get('/api/world', (req, res) => {
    res.json({ items: worldItems, npcs, sportsScores, worldRev, tycoon: tycoonState });
});

app.post('/api/world', (req, res) => {
    if (Array.isArray(req.body)) {
        worldItems = req.body;
        worldRev = Date.now();
        saveAllToDisk();
        return res.json({ success: true, count: worldItems.length, worldRev });
    }
    res.status(400).json({ error: 'Expected array' });
});

app.post('/api/world/rehydrate', (req, res) => {
    const { items, savedNpcs, savedTycoon, forceNpcs } = req.body || {};
    let restored = false;
    if (worldItems.length === 0 && Array.isArray(items) && items.length > 0) {
        worldItems = items; worldRev = Date.now(); restored = true;
    }
    if (Array.isArray(savedNpcs) && savedNpcs.length > 0 && (forceNpcs || npcs.length <= 1)) {
        npcs = savedNpcs; restored = true;
    }
    const hasUnlockedAny = Object.keys(tycoonState.unlockedPads || {}).some(k => k !== 'dropper1' && tycoonState.unlockedPads[k]);
    if (!hasUnlockedAny && tycoonState.walletCash <= 50 && savedTycoon && typeof savedTycoon.walletCash === 'number') {
        tycoonState = Object.assign(createDefaultTycoon(), savedTycoon);
        tycoonState.rev = Date.now(); restored = true;
    }
    if (restored) saveAllToDisk();
    res.json({ success: true, restored, worldCount: worldItems.length, worldRev, npcCount: npcs.length, npcs, tycoon: tycoonState });
});

app.post('/api/world/update-item', (req, res) => {
    const { id, isOpen, inventory, assignedTo, assignedWorkers, merchantSkin, shopItems, merchantName, signText, signColor, signBg, lastUrl, farmConfig } = req.body || {};
    const target = worldItems.find(it => it.id === id);
    if (!target) return res.status(404).json({ error: 'Item not found' });

    if (typeof isOpen === 'boolean') target.isOpen = isOpen;
    if (Array.isArray(inventory)) target.inventory = inventory.slice(0, 10);
    if (assignedTo !== undefined) {
        target.assignedTo = assignedTo;
        const foundNpc = npcs.find(n => n.name === assignedTo || n.id === assignedTo);
        if (foundNpc) {
            foundNpc.assignedBedId = target.id;
            addDiary(foundNpc, 'Assigned to my very own bed!');
        }
    }
    // Office Building Employee Roster (10 AM - 4 PM EST Shift)
    if (Array.isArray(assignedWorkers)) {
        target.assignedWorkers = assignedWorkers;
        npcs.forEach(n => {
            if (assignedWorkers.includes(n.id)) {
                n.assignedOfficeId = target.id;
                addDiary(n, 'Hired at Badabing Corp Tower! My shift is 10:00 AM - 4:00 PM EST.');
                addLog(n, 'Assigned to 10AM-4PM shift at Office Tower.');
            } else if (n.assignedOfficeId === target.id) {
                n.assignedOfficeId = null;
            }
        });
    }
    if (typeof merchantSkin === 'number') target.merchantSkin = merchantSkin;
    if (Array.isArray(shopItems)) target.shopItems = shopItems;
    if (typeof merchantName === 'string') target.merchantName = merchantName;
    if (typeof signText === 'string') target.signText = signText;
    if (typeof signColor === 'string') target.signColor = signColor;
    if (typeof signBg === 'string') target.signBg = signBg;
    if (typeof lastUrl === 'string') target.lastUrl = lastUrl;

    if (farmConfig && target.type === 'farm_plot') {
        target.farmState = {
            assignedNpcId: farmConfig.assignedNpcId || 'peanut',
            cropType: farmConfig.cropType || '🍅 Slurp Tomatoes',
            loopsRemaining: Number(farmConfig.loops) || 1,
            stage: (Number(farmConfig.loops) || 0) > 0 ? 'needs_planting' : 'idle',
            waterCount: 0, stageStartedAt: Date.now(), progressPct: 0
        };
    }

    worldRev = Date.now();
    saveAllToDisk();
    res.json({ success: true, item: target, npcs, worldRev });
});

app.post('/api/npcs/spawn', (req, res) => {
    const { name, species, x, z } = req.body || {};
    if (!name || !species) return res.status(400).json({ error: 'Name and species required' });
    const startX = typeof x === 'number' ? x : 6, startZ = typeof z === 'number' ? z : 12;
    const newCompanion = {
        id: 'npc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: name.trim(), species, x: startX, z: startZ, rotY: 0,
        targetX: startX + 14, targetZ: startZ - 14, lastProgressDist: 20, stallTicks: 0, waveUntil: 0,
        assignedOfficeId: null, wallet: 200, inventory: ['🍎 Welcome Apple'],
        mood: 'Excited 🎉', hunger: 90, energy: 95, activity: 'Roaming Town', assignedBedId: null,
        wants: ['Work at the Office Tower 🏢', 'Help farm crops 🌱', 'Explore Town ✨'],
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
    } else if (actionType === 'add_book') {
        npc.inventory.push(itemName || '📖 Recipe Cooking Book');
    } else if (actionType === 'feed') {
        npc.hunger = 100; npc.mood = 'Stuffed & Happy 🍔';
    } else if (actionType === 'rest') {
        npc.energy = 100; npc.mood = 'Super Charged ⚡';
    } else if (actionType === 'add_funds') {
        npc.wallet += (Number(amount) || 50);
    } else if (actionType === 'use_item') {
        const idx = Number(slotIndex);
        if (idx >= 0 && idx < npc.inventory.length) {
            npc.inventory.splice(idx, 1);
            npc.hunger = Math.min(100, npc.hunger + 30);
            npc.energy = Math.min(100, npc.energy + 25);
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
