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
        targetX: 20,
        targetZ: -16,
        lastCheckX: 6,
        lastCheckZ: 14,
        waveUntil: 0,
        wallet: 250,
        inventory: ['🎋 Fresh Bamboo', '🥪 Deli Sub', '📖 Master Chef Cooking Vol. 1'],
        mood: 'Happy ✨',
        hunger: 88,
        energy: 92,
        activity: 'Roaming Town',
        assignedBedId: null,
        wants: ['Tend a Farm Plot 🌱', 'Visit the Italian Deli 🥪', 'Read a Cooking Book 📚'],
        diary: [
            'Dear Diary: Woke up to a gorgeous sunrise in The Badabing!',
            'Ready to plant and water crops whenever the Gorilla Gods assign me a Farm Plot!'
        ],
        activityLog: [
            '[' + new Date().toLocaleTimeString() + '] Started roaming town freely.'
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
    if (!Array.isArray(n.inventory)) n.inventory = ['🍎 Sweet Apple'];
    if (typeof n.x !== 'number' || isNaN(n.x)) n.x = 6;
    if (typeof n.z !== 'number' || isNaN(n.z)) n.z = 14;
    if (typeof n.targetX !== 'number' || isNaN(n.targetX)) n.targetX = n.x + 14;
    if (typeof n.targetZ !== 'number' || isNaN(n.targetZ)) n.targetZ = n.z - 14;
    n.lastCheckX = n.x;
    n.lastCheckZ = n.z;
    n.waveUntil = 0;
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

// =========================================================
// SOLID BUILDING FOOTPRINT & LINE-OF-SIGHT RAYCAST CHECKER
// =========================================================
function isNpcBlockedByWall(nx, nz, ignoreItemId) {
    const pad = 2.0;
    for (let i = 0; i < worldItems.length; i++) {
        const it = worldItems[i];
        if (ignoreItemId && it.id === ignoreItemId) continue;
        if ((it.y || 0) > 2.5) continue;

        const dx = nx - it.x;
        const dz = nz - it.z;
        const rad = -((it.rot || 0) * Math.PI) / 180;
        const lx = dx * Math.cos(rad) - dz * Math.sin(rad);
        const lz = dx * Math.sin(rad) + dz * Math.cos(rad);

        if (it.type === 'wall' || it.type === 'window' || it.type === 'fence' || (it.type === 'doorway' && !it.isOpen)) {
            if (Math.abs(lx) < 2.2 + pad && Math.abs(lz) < 0.4 + pad) return true;
        } else if (it.type === 'doorway' && it.isOpen) {
            if (Math.abs(lz) < 0.4 + pad && (Math.abs(lx - 1.4) < 0.6 + pad || Math.abs(lx + 1.4) < 0.6 + pad)) return true;
        } else if (it.type === 'mcdonalds' || it.type === 'hobby_store' || it.type === 'deli' || it.type === 'library' || it.type === 'gym') {
            if (Math.abs(lx) < 8.4 + pad && Math.abs(lz) < 6.4 + pad) return true;
        } else if (it.type === 'walmart') {
            if (Math.abs(lx) < 12.4 + pad && Math.abs(lz) < 9.4 + pad) return true;
        } else if (it.type === 'mechanic_shop') {
            if (Math.abs(lx) < 10.4 + pad && Math.abs(lz) < 8.4 + pad) return true;
        } else if (it.type === 'watch_tower') {
            if (Math.abs(lx) < 2.8 + pad && Math.abs(lz) < 2.8 + pad) return true;
        } else if (it.type === 'fountain' || it.type === 'gorilla_statue') {
            if (Math.hypot(lx, lz) < 4.0 + pad) return true;
        } else if (it.type === 'pond') {
            if (Math.hypot(lx / 1.3, lz) < 6.2 + pad) return true;
        } else if (it.type === 'swimming_pool') {
            if (Math.abs(lx) < 9.0 + pad && Math.abs(lz) < 6.0 + pad) return true;
        } else if (it.type === 'ice_rink') {
            if (Math.abs(lx) < 12.0 + pad && Math.abs(lz) < 8.0 + pad) return true;
        } else if (it.type === 'basketball_court' || it.type === 'tennis_court') {
            if (Math.abs(lx) < 14.0 + pad && Math.abs(lz) < 9.0 + pad) return true;
        } else if (it.type === 'soccer_court') {
            if (Math.abs(lx) < 17.0 + pad && Math.abs(lz) < 11.0 + pad) return true;
        } else if (it.type === 'arcade' || it.type === 'locker' || it.type === 'computer_desk' || it.type === 'merchant' || it.type === 'bed' || it.type === 'sign_post') {
            if (Math.abs(lx) < 1.8 + pad && Math.abs(lz) < 1.5 + pad) return true;
        }
    }
    return false;
}

// Checks if the entire straight line between (x1,z1) and (x2,z2) is clear of structures
function isPathClear(x1, z1, x2, z2, ignoreItemId) {
    const dist = Math.hypot(x2 - x1, z2 - z1);
    if (dist < 0.5) return true;
    const steps = Math.ceil(dist / 0.8);
    for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const cx = x1 + (x2 - x1) * t;
        const cz = z1 + (z2 - z1) * t;
        if (isNpcBlockedByWall(cx, cz, ignoreItemId)) return false;
    }
    return true;
}

// Computes a safe standing spot outside the front entrance of any rotated structure
function getStructureApproachPoint(item, offsetDist) {
    const rad = ((item.rot || 0) * Math.PI) / 180;
    const d = offsetDist || 8.5;
    return {
        x: +(item.x + Math.sin(rad) * d).toFixed(1),
        z: +(item.z + Math.cos(rad) * d).toFixed(1)
    };
}

function pickRandomRoamWaypoint(npc) {
    // First try to find a waypoint with a 100% clear line-of-sight path
    for (let attempt = 0; attempt < 25; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 38;
        const tx = +(npc.x + Math.cos(angle) * dist).toFixed(1);
        const tz = +(npc.z + Math.sin(angle) * dist).toFixed(1);
        if (Math.abs(tx) < 160 && Math.abs(tz) < 160 && !isNpcBlockedByWall(tx, tz) && isPathClear(npc.x, npc.z, tx, tz)) {
            npc.targetX = tx;
            npc.targetZ = tz;
            return;
        }
    }
    // Fallback: short open step in any unblocked direction
    for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const tx = +(npc.x + Math.cos(ang) * 8).toFixed(1);
        const tz = +(npc.z + Math.sin(ang) * 8).toFixed(1);
        if (!isNpcBlockedByWall(tx, tz)) {
            npc.targetX = tx;
            npc.targetZ = tz;
            return;
        }
    }
}

const activePlayers = {};
const GOD_COLORS = ['#fa9549', '#38bdf8', '#4ade80', '#c084fc'];
let sportsScores = { hoops: 0, goals: 0, rallies: 0 };

// Shared World Day/Night Clock (0 to 24 hours; full day cycle = 12 real minutes)
let worldTimeHours = 10.5; // Starts at 10:30 AM

let tickCount = 0;
const STEER_ANGLES = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.57, -1.57, 2.2, -2.2];

// =========================================================
// AUTONOMOUS FARMING & SMOOTH COMPANION SIMULATION LOOP
// =========================================================
const CROP_TOTAL_GROW_MS = 5 * 60 * 1000; // 5 minutes (300,000 ms) total completion time
const SECOND_WATER_DELAY_MS = 90 * 1000;  // 90 seconds after 1st watering

setInterval(() => {
    tickCount++;
    const now = Date.now();

    // Advance Day/Night Clock smoothly
    worldTimeHours = (worldTimeHours + 0.00333) % 24;

    // 1. Update Farm Plots State Machine (5-min growth, 2 waterings required)
    let worldDirty = false;
    worldItems.forEach(it => {
        if (it.type !== 'farm_plot') return;
        if (!it.cropType) it.cropType = 'Sweet Corn 🌽';
        if (!it.farmStage) it.farmStage = 'empty'; // 'empty', 'planted_needs_water1', 'growing_water1', 'needs_water2', 'growing_water2', 'ready'

        if (it.farmStage === 'growing_water1' && it.water1At) {
            // 90 seconds after 1st watering -> require 2nd watering!
            if (now - it.water1At >= SECOND_WATER_DELAY_MS) {
                it.farmStage = 'needs_water2';
                worldDirty = true;
            }
        }

        if (it.farmStage === 'growing_water2' && it.plantedAt && it.water2Done) {
            // Total completion time: 5 minutes (300s) from planting
            if (now - it.plantedAt >= CROP_TOTAL_GROW_MS) {
                it.farmStage = 'ready';
                worldDirty = true;
            }
        }
    });

    // 2. Update Companions (Farming Duties + Needs + Unstuck Roaming)
    npcs.forEach((npc) => {
        npc.hunger = Math.max(10, +(npc.hunger - 0.008).toFixed(2));
        npc.energy = Math.max(10, +(npc.energy - 0.006).toFixed(2));

        if (tickCount % 300 === 0) {
            npc.wallet = (npc.wallet || 0) + 5;
        }

        // Brief 1.2-second wave back
        if (npc.waveUntil && now < npc.waveUntil) {
            npc.activity = 'Waving Back! 👋';
            return;
        }

        // Anti-Stuck Progress Watchdog: Every 3 seconds (30 ticks), verify actual movement
        if (tickCount % 30 === 0) {
            const movedDist = Math.hypot(npc.x - (npc.lastCheckX || npc.x), npc.z - (npc.lastCheckZ || npc.z));
            const distToGoal = Math.hypot((npc.targetX || npc.x) - npc.x, (npc.targetZ || npc.z) - npc.z);
            if (distToGoal > 2.5 && movedDist < 1.1) {
                // Companion is stuck trying to reach an unreachable spot -> pick a verified clear path!
                pickRandomRoamWaypoint(npc);
            }
            npc.lastCheckX = npc.x;
            npc.lastCheckZ = npc.z;
        }

        // Priority 1: Check Assigned Farm Plots Needing Care (Planting, Water 1, Water 2, or Harvest)
        const urgentPlot = worldItems.find(it =>
            it.type === 'farm_plot' &&
            (it.assignedFarmerId === npc.id || it.assignedFarmerId === npc.name) &&
            (it.farmStage === 'empty' || it.farmStage === 'planted_needs_water1' || it.farmStage === 'needs_water2' || it.farmStage === 'ready')
        );

        const assignedBed = worldItems.find(it => it.id === npc.assignedBedId);
        const eatery = worldItems.find(it => it.type === 'deli' || it.type === 'mcdonalds');

        let destX = npc.targetX;
        let destZ = npc.targetZ;
        let activeTaskType = 'roam';

        if (urgentPlot) {
            activeTaskType = 'farm';
            destX = urgentPlot.x;
            destZ = urgentPlot.z + 2.6; // Stand right at the edge of the 4x4m plot
            npc.targetX = destX;
            npc.targetZ = destZ;
            if (urgentPlot.farmStage === 'empty') npc.activity = 'Planting ' + urgentPlot.cropType + ' 🌱';
            else if (urgentPlot.farmStage === 'planted_needs_water1') npc.activity = 'Watering ' + urgentPlot.cropType + ' (1/2) 💧';
            else if (urgentPlot.farmStage === 'needs_water2') npc.activity = 'Watering ' + urgentPlot.cropType + ' (2/2) 🚿';
            else if (urgentPlot.farmStage === 'ready') npc.activity = 'Harvesting ' + urgentPlot.cropType + ' 🌾';
            npc.mood = 'Hardworking Farmer 👨‍🌾';
        } else if (npc.energy < 22 && assignedBed) {
            activeTaskType = 'sleep';
            const approach = getStructureApproachPoint(assignedBed, 2.2);
            destX = approach.x;
            destZ = approach.z;
            npc.targetX = destX;
            npc.targetZ = destZ;
            npc.activity = 'Heading to Bed 🛌';
            npc.mood = 'Sleepy 😴';
        } else if (npc.hunger < 25 && eatery) {
            activeTaskType = 'eat';
            const approach = getStructureApproachPoint(eatery, 8.8);
            destX = approach.x;
            destZ = approach.z;
            npc.targetX = destX;
            npc.targetZ = destZ;
            npc.activity = eatery.type === 'deli' ? 'Visiting the Deli 🥪' : "Visiting McDonald's 🍔";
            npc.mood = 'Hungry 😋';
        } else {
            const distToTarget = Math.hypot((destX || 0) - npc.x, (destZ || 0) - npc.z);
            if (typeof destX !== 'number' || typeof destZ !== 'number' || isNaN(distToTarget) || distToTarget < 2.2) {
                pickRandomRoamWaypoint(npc);
                destX = npc.targetX;
                destZ = npc.targetZ;
                npc.activity = 'Roaming Town ✨';
                npc.mood = (npc.hunger > 55 && npc.energy > 55) ? 'Happy ✨' : 'Curious 🐾';
            }
        }

        const dx = destX - npc.x;
        const dz = destZ - npc.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 1.35) {
            const baseAngle = Math.atan2(dx, dz);
            const speed = 0.25; // 2.5 meters per second
            let moved = false;
            const currentlyInsideWall = isNpcBlockedByWall(npc.x, npc.z, urgentPlot && urgentPlot.id);

            for (let a = 0; a < STEER_ANGLES.length; a++) {
                const tryAngle = baseAngle + STEER_ANGLES[a];
                const stepX = npc.x + Math.sin(tryAngle) * speed;
                const stepZ = npc.z + Math.cos(tryAngle) * speed;
                const lookAheadX = npc.x + Math.sin(tryAngle) * 2.2;
                const lookAheadZ = npc.z + Math.cos(tryAngle) * 2.2;

                if (
                    currentlyInsideWall ||
                    (!isNpcBlockedByWall(stepX, stepZ, urgentPlot && urgentPlot.id) &&
                     !isNpcBlockedByWall(lookAheadX, lookAheadZ, urgentPlot && urgentPlot.id))
                ) {
                    npc.x = +stepX.toFixed(2);
                    npc.z = +stepZ.toFixed(2);
                    npc.rotY = +tryAngle.toFixed(2);
                    moved = true;
                    break;
                }
            }

            if (!moved) {
                pickRandomRoamWaypoint(npc);
            }
        } else {
            // Reached Destination! Execute Task:
            if (activeTaskType === 'farm' && urgentPlot) {
                if (urgentPlot.farmStage === 'empty') {
                    urgentPlot.farmStage = 'planted_needs_water1';
                    urgentPlot.plantedAt = now;
                    urgentPlot.water1At = null;
                    urgentPlot.water2Done = false;
                    addLog(npc, 'Planted ' + urgentPlot.cropType + ' seeds in Farm Plot.');
                    worldDirty = true;
                } else if (urgentPlot.farmStage === 'planted_needs_water1') {
                    urgentPlot.farmStage = 'growing_water1';
                    urgentPlot.water1At = now;
                    addLog(npc, 'Watered ' + urgentPlot.cropType + ' (1st watering complete; next in 90s).');
                    addDiary(npc, 'Planted and watered my ' + urgentPlot.cropType + ' patch!');
                    worldDirty = true;
                    pickRandomRoamWaypoint(npc);
                } else if (urgentPlot.farmStage === 'needs_water2') {
                    urgentPlot.farmStage = 'growing_water2';
                    urgentPlot.water2Done = true;
                    urgentPlot.water2At = now;
                    addLog(npc, 'Watered ' + urgentPlot.cropType + ' (2nd watering complete!).');
                    addDiary(npc, 'Gave my ' + urgentPlot.cropType + ' its second watering right on schedule!');
                    worldDirty = true;
                    pickRandomRoamWaypoint(npc);
                } else if (urgentPlot.farmStage === 'ready') {
                    const harvestedCrop = urgentPlot.cropType || 'Fresh Crop 🌽';
                    if (!Array.isArray(npc.inventory)) npc.inventory = [];
                    npc.inventory.push(harvestedCrop, harvestedCrop);
                    npc.wallet = (npc.wallet || 0) + 25;
                    npc.mood = 'Proud Harvester 🌾✨';
                    addLog(npc, 'Harvested ' + harvestedCrop + ' (+2 to Bag & +$25)! Replanting...');
                    addDiary(npc, 'Harvested a bumper crop of ' + harvestedCrop + ' after 5 minutes of care!');
                    // Reset plot to empty so companion automatically replants the God's chosen crop
                    urgentPlot.farmStage = 'empty';
                    urgentPlot.plantedAt = null;
                    urgentPlot.water1At = null;
                    urgentPlot.water2Done = false;
                    worldDirty = true;
                }
            } else if (activeTaskType === 'sleep' && assignedBed) {
                npc.activity = 'Sleeping in Bed 💤';
                npc.energy = Math.min(100, +(npc.energy + 1.4).toFixed(1));
                npc.mood = 'Well Rested 🌟';
                if (npc.energy >= 95) {
                    addDiary(npc, 'Had the best nap in my cozy bed!');
                    pickRandomRoamWaypoint(npc);
                }
            } else if (activeTaskType === 'eat' && eatery) {
                npc.activity = eatery.type === 'deli' ? 'Eating Deli Sub 🥪' : 'Eating Happy Meal 🍟';
                npc.hunger = Math.min(100, +(npc.hunger + 1.5).toFixed(1));
                npc.mood = 'Full & Happy 😋';
                if (npc.hunger >= 95) {
                    addDiary(npc, 'Grabbed a fresh meal in town!');
                    pickRandomRoamWaypoint(npc);
                }
            } else {
                pickRandomRoamWaypoint(npc);
            }
        }
    });

    if (worldDirty || tickCount % 50 === 0) {
        saveAllToDisk();
    }
}, 100);

// Co-op Sync Endpoint (Includes Farm Plots Live Status & World Clock)
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
                id,
                slot,
                isGod: allowGod,
                name: allowGod ? (customName || ('Gorilla God ' + (currentGods.length + 1))) : ('Visitor ' + slot),
                color: allowGod ? GOD_COLORS[currentGods.length % 4] : '#fde047',
                x: x || 0,
                y: y || 0,
                z: z || 20,
                rotY: rotY || 0,
                isFlying: !!isFlying,
                lastSeen: now
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
        .map(it => ({
            id: it.id,
            cropType: it.cropType || 'Sweet Corn 🌽',
            assignedFarmerId: it.assignedFarmerId || 'peanut',
            farmStage: it.farmStage || 'empty',
            plantedAt: it.plantedAt || null,
            water1At: it.water1At || null,
            water2Done: !!it.water2Done
        }));

    res.json({
        gods: Object.values(activePlayers),
        npcs: npcs,
        worldCount: worldItems.length,
        sportsScores,
        worldTimeHours: +worldTimeHours.toFixed(3),
        farmStates,
        serverNow: now
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
    res.json({ items: worldItems, npcs: npcs, sportsScores, worldTimeHours });
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
    const {
        id, isOpen, inventory, assignedTo, merchantSkin, shopItems, merchantName,
        signText, signColor, signBg, lastUrl, cropType, assignedFarmerId, resetCrop
    } = req.body || {};
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
    if (typeof signText === 'string') target.signText = signText;
    if (typeof signColor === 'string') target.signColor = signColor;
    if (typeof signBg === 'string') target.signBg = signBg;
    if (typeof lastUrl === 'string') target.lastUrl = lastUrl;

    // Farm Plot Updates (God selects crop & responsible companion)
    if (typeof cropType === 'string') target.cropType = cropType;
    if (typeof assignedFarmerId === 'string') {
        target.assignedFarmerId = assignedFarmerId;
        const farmer = npcs.find(n => n.id === assignedFarmerId || n.name === assignedFarmerId);
        if (farmer) {
            addLog(farmer, 'Assigned responsibility for ' + (target.cropType || 'Farm Plot') + '!');
            addDiary(farmer, 'I am now in charge of growing ' + (target.cropType || 'crops') + ' for the town!');
        }
    }
    if (resetCrop) {
        target.farmStage = 'empty';
        target.plantedAt = null;
        target.water1At = null;
        target.water2Done = false;
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
        lastCheckX: startX,
        lastCheckZ: startZ,
        waveUntil: 0,
        wallet: 200,
        inventory: ['🍎 Welcome Apple', '🧃 Berry Juice'],
        mood: 'Excited 🎉',
        hunger: 90,
        energy: 95,
        activity: 'Roaming Town',
        assignedBedId: null,
        wants: ['Make friends with Peanut 🐼', 'Tend a Farm Plot 🌱', 'Explore the Library & Gym 🏋️'],
        diary: ['Dear Diary: Today I arrived in The Badabing! I have $200 in my wallet!'],
        activityLog: ['[' + new Date().toLocaleTimeString() + '] Spawned as a cute ' + species + '!']
    };
    npcs.push(newCompanion);
    saveAllToDisk();
    res.json({ success: true, companion: newCompanion, npcs });
});

app.post('/api/npcs/delete', (req, res) => {
    const { id } = req.body || {};
    if (!id || id === 'peanut') {
        return res.status(400).json({ error: 'Peanut is the town founder and cannot be deleted!' });
    }
    npcs = npcs.filter(n => n.id !== id);
    worldItems.forEach(it => {
        if (it.assignedTo === id) it.assignedTo = null;
        if (it.assignedFarmerId === id) it.assignedFarmerId = 'peanut';
    });
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
        addLog(npc, 'Waved back for a second!');
        addDiary(npc, 'Someone waved at me and I gave them a happy wave back!');
    } else if (actionType === 'add_book') {
        npc.inventory.push(itemName || '📖 Recipe Cooking Book');
        addDiary(npc, 'Borrowed "' + (itemName || 'Cooking Book') + '" from the library!');
        addLog(npc, 'Added book to inventory.');
    } else if (actionType === 'feed') {
        npc.hunger = 100;
        npc.mood = 'Stuffed & Happy 🍔';
        npc.activity = 'Enjoying Meal';
        addLog(npc, 'Fed by a player.');
    } else if (actionType === 'rest') {
        npc.energy = 100;
        npc.mood = 'Super Charged ⚡';
        npc.activity = 'Doing Zoomies';
        addLog(npc, 'Energized by player.');
    } else if (actionType === 'cheer') {
        npc.mood = 'Loved ❤️';
        npc.activity = 'Happy Dance';
        addDiary(npc, 'Got head pats today!');
    } else if (actionType === 'add_funds') {
        const bonus = Number(amount) || 50;
        npc.wallet += bonus;
        addLog(npc, 'Received +$' + bonus + ' allowance!');
    } else if (actionType === 'use_item') {
        const idx = Number(slotIndex);
        if (idx >= 0 && idx < npc.inventory.length) {
            const used = npc.inventory.splice(idx, 1)[0];
            npc.hunger = Math.min(100, npc.hunger + 30);
            npc.energy = Math.min(100, npc.energy + 25);
            npc.mood = 'Delighted 🌟';
            npc.activity = 'Used ' + used;
            addLog(npc, 'Used ' + used + ' from bag.');
        }
    } else if (actionType === 'buy') {
        const price = Number(itemPrice) || 0;
        if (npc.wallet < price) {
            return res.status(400).json({ error: npc.name + ' only has $' + npc.wallet + ' in wallet!' });
        }
        npc.wallet -= price;
        npc.inventory.push(itemName || '🎁 Mystery Item');
        npc.hunger = Math.min(100, npc.hunger + 25);
        npc.energy = Math.min(100, npc.energy + 20);
        npc.mood = 'Spoiled & Joyful 🛍️';
        addDiary(npc, 'Bought ' + itemName + ' for $' + price + '!');
        addLog(npc, 'Bought ' + itemName + ' from Merchant.');
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
