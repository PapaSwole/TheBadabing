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
        vx: 0,
        vz: 0,
        rotY: 0,
        targetX: 24,
        targetZ: -18,
        stuckTicks: 0,
        waveUntil: 0,
        savedActivity: 'Roaming Town',
        wallet: 250,
        inventory: ['🎋 Fresh Bamboo', '🥪 Deli Sub', '📖 Cooking 101'],
        mood: 'Happy ✨',
        hunger: 88,
        energy: 92,
        activity: 'Roaming Town',
        assignedBedId: null,
        wants: ['Check out a Cooking Book at the Library 📚', 'Play Ape Kong on the Arcade Cabinet 🕹️', 'Go for a swim in the Pool 🏊'],
        diary: [
            'Dear Diary: Woke up feeling super cute in The Badabing!',
            'Can\'t wait to read cooking books at the new Library and skate on the Ice Rink!'
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
    if (typeof n.vx !== 'number' || isNaN(n.vx)) n.vx = 0;
    if (typeof n.vz !== 'number' || isNaN(n.vz)) n.vz = 0;
    if (typeof n.targetX !== 'number' || isNaN(n.targetX)) n.targetX = n.x + 20;
    if (typeof n.targetZ !== 'number' || isNaN(n.targetZ)) n.targetZ = n.z - 20;
    n.stuckTicks = 0;
    n.waveUntil = 0;
    n.savedActivity = n.activity || 'Roaming Town';
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

// Generous 2.4m Border Buffer Around Buildings & Walls So Companions Never Get Stuck
function isNpcBlockedByWall(nx, nz) {
    const pad = 2.4; // Wide safety margin around all structures
    for (let i = 0; i < worldItems.length; i++) {
        const it = worldItems[i];
        if ((it.y || 0) > 2.2) continue;

        const dx = nx - it.x;
        const dz = nz - it.z;
        const rad = -((it.rot || 0) * Math.PI) / 180;
        const lx = dx * Math.cos(rad) - dz * Math.sin(rad);
        const lz = dx * Math.sin(rad) + dz * Math.cos(rad);

        if (it.type === 'wall' || it.type === 'window' || it.type === 'fence' || (it.type === 'doorway' && !it.isOpen)) {
            if (Math.abs(lx) < 2.0 + pad && Math.abs(lz) < 0.3 + pad) return true;
        } else if (it.type === 'doorway' && it.isOpen) {
            if (Math.abs(lz) < 0.3 + pad && (Math.abs(lx - 1.4) < 0.5 + pad || Math.abs(lx + 1.4) < 0.5 + pad)) return true;
        } else if (it.type === 'mcdonalds' || it.type === 'hobby_store' || it.type === 'deli' || it.type === 'gym') {
            if (Math.abs(lx) < 8 + pad && Math.abs(lz) < 6 + pad) return true;
        } else if (it.type === 'library') {
            if (Math.abs(lx) < 9 + pad && Math.abs(lz) < 7 + pad) return true;
        } else if (it.type === 'walmart') {
            if (Math.abs(lx) < 12 + pad && Math.abs(lz) < 9 + pad) return true;
        } else if (it.type === 'mechanic_shop') {
            if (Math.abs(lx) < 10 + pad && Math.abs(lz) < 8 + pad) return true;
        } else if (it.type === 'watch_tower') {
            if (Math.abs(lx) < 3.2 + pad && Math.abs(lz) < 3.2 + pad) return true;
        } else if (it.type === 'swimming_pool' || it.type === 'ice_rink') {
            if (Math.abs(lx) < 9 + pad && Math.abs(lz) < 6 + pad) return true;
        } else if (it.type === 'fountain' || it.type === 'gorilla_statue') {
            if (Math.hypot(lx, lz) < 3.6 + pad) return true;
        } else if (it.type === 'pond') {
            if (Math.hypot(lx / 1.3, lz) < 6.5 + pad) return true;
        } else if (it.type === 'locker' || it.type === 'computer_desk' || it.type === 'merchant' || it.type === 'arcade_machine') {
            if (Math.abs(lx) < 1.8 + pad && Math.abs(lz) < 1.4 + pad) return true;
        }
    }
    return false;
}

function pickRandomRoamWaypoint(npc) {
    for (let attempt = 0; attempt < 16; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 18 + Math.random() * 65;
        const tx = +(Math.cos(angle) * radius).toFixed(1);
        const tz = +(Math.sin(angle) * radius).toFixed(1);
        if (!isNpcBlockedByWall(tx, tz)) {
            npc.targetX = tx;
            npc.targetZ = tz;
            return;
        }
    }
    npc.targetX = +(npc.x + (Math.random() - 0.5) * 40).toFixed(1);
    npc.targetZ = +(npc.z + (Math.random() - 0.5) * 40).toFixed(1);
}

// Active Players Registry
const activePlayers = {};
const GOD_COLORS = ['#fa9549', '#38bdf8', '#4ade80', '#c084fc'];
let sportsScores = { hoops: 0, goals: 0, rallies: 0 };

let tickCount = 0;
const STEER_ANGLES = [0, 0.35, -0.35, 0.75, -0.75, 1.15, -1.15, 1.65, -1.65, 2.3, -2.3];

setInterval(() => {
    tickCount++;
    const now = Date.now();

    npcs.forEach((npc) => {
        npc.hunger = Math.max(10, +(npc.hunger - 0.01).toFixed(2));
        npc.energy = Math.max(10, +(npc.energy - 0.008).toFixed(2));

        if (tickCount % 300 === 0) {
            npc.wallet = (npc.wallet || 0) + 5;
        }

        // 1-Second Wave Pause & Automatic Resume of Previous Activity
        if (npc.waveUntil && now < npc.waveUntil) {
            npc.activity = 'Waving Back! 👋';
            return;
        } else if (npc.waveUntil && now >= npc.waveUntil) {
            npc.waveUntil = 0;
            npc.activity = npc.savedActivity || 'Roaming Town';
        }

        const assignedBed = worldItems.find(it => it.id === npc.assignedBedId);
        const eatery = worldItems.find(it => it.type === 'deli' || it.type === 'mcdonalds');

        let destX = npc.targetX;
        let destZ = npc.targetZ;

        if (npc.energy < 22 && assignedBed) {
            destX = assignedBed.x;
            destZ = assignedBed.z + 3.2;
            npc.activity = 'Heading to Bed 🛌';
            npc.mood = 'Sleepy 😴';
        } else if (npc.hunger < 25 && eatery) {
            destX = eatery.x;
            destZ = eatery.z + 9.5;
            npc.activity = eatery.type === 'deli' ? 'Heading to the Deli 🥪' : "Heading to McDonald's 🍔";
            npc.mood = 'Hungry 😋';
        } else {
            const distToTarget = Math.hypot((destX || 0) - npc.x, (destZ || 0) - npc.z);
            if (typeof destX !== 'number' || typeof destZ !== 'number' || isNaN(distToTarget) || distToTarget < 2.8) {
                pickRandomRoamWaypoint(npc);
                destX = npc.targetX;
                destZ = npc.targetZ;
                npc.activity = 'Strolling to (' + Math.round(destX) + ', ' + Math.round(destZ) + ')';
                npc.savedActivity = npc.activity;
                npc.mood = (npc.hunger > 55 && npc.energy > 55) ? 'Happy ✨' : 'Curious 🐾';
            }
        }

        const dx = destX - npc.x;
        const dz = destZ - npc.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.9) {
            const baseAngle = Math.atan2(dx, dz);
            const maxSpeed = 0.25;
            let chosenAngle = null;
            const currentlyInside = isNpcBlockedByWall(npc.x, npc.z);

            for (let a = 0; a < STEER_ANGLES.length; a++) {
                const tryAngle = baseAngle + STEER_ANGLES[a];
                const probeX = npc.x + Math.sin(tryAngle) * 1.6;
                const probeZ = npc.z + Math.cos(tryAngle) * 1.6;

                if (currentlyInside || !isNpcBlockedByWall(probeX, probeZ)) {
                    chosenAngle = tryAngle;
                    break;
                }
            }

            if (chosenAngle !== null) {
                // Smooth velocity-blended natural steering
                const desiredVx = Math.sin(chosenAngle) * maxSpeed;
                const desiredVz = Math.cos(chosenAngle) * maxSpeed;
                npc.vx = (npc.vx || 0) * 0.72 + desiredVx * 0.28;
                npc.vz = (npc.vz || 0) * 0.72 + desiredVz * 0.28;

                npc.x = +(npc.x + npc.vx).toFixed(2);
                npc.z = +(npc.z + npc.vz).toFixed(2);
                npc.rotY = +(Math.atan2(npc.vx, npc.vz)).toFixed(2);
                npc.stuckTicks = 0;
            } else {
                npc.stuckTicks = (npc.stuckTicks || 0) + 1;
                if (npc.stuckTicks > 4) {
                    const escapeAngle = Math.random() * Math.PI * 2;
                    npc.x = +(npc.x + Math.sin(escapeAngle) * 2.2).toFixed(2);
                    npc.z = +(npc.z + Math.cos(escapeAngle) * 2.2).toFixed(2);
                    pickRandomRoamWaypoint(npc);
                    npc.stuckTicks = 0;
                }
            }
        } else {
            if (npc.energy < 22 && assignedBed) {
                npc.activity = 'Sleeping in Bed 💤';
                npc.energy = Math.min(100, +(npc.energy + 1.2).toFixed(1));
                npc.mood = 'Well Rested 🌟';
                if (npc.energy >= 95) {
                    addDiary(npc, 'Had the best nap in my cozy bed!');
                    pickRandomRoamWaypoint(npc);
                }
            } else if (npc.hunger < 25 && eatery) {
                npc.activity = eatery.type === 'deli' ? 'Eating Deli Pastrami Sub 🥪' : 'Eating Happy Meal 🍟';
                npc.hunger = Math.min(100, +(npc.hunger + 1.4).toFixed(1));
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

    if (tickCount % 50 === 0) {
        saveAllToDisk();
    }
}, 100);

// Co-op Sync Endpoint (Supports Custom God Names + Visitors + Up to 4 Gorilla Gods)
app.post('/api/coop/sync', (req, res) => {
    const now = Date.now();
    for (const id of Object.keys(activePlayers)) {
        if (now - activePlayers[id].lastSeen > 6000) delete activePlayers[id];
    }

    const { id, x, y, z, rotY, isFlying, isGod, godName } = req.body || {};
    if (id) {
        const cleanGodName = (typeof godName === 'string' && godName.trim()) ? godName.trim().substring(0, 18) : null;
        if (!activePlayers[id]) {
            const currentPlayers = Object.values(activePlayers);
            const currentGods = currentPlayers.filter(p => p.isGod);
            const allowGod = !!isGod && currentGods.length < 4;
            const slot = (currentPlayers.length % 4) + 1;

            activePlayers[id] = {
                id,
                slot,
                isGod: allowGod,
                name: allowGod ? (cleanGodName || ('Gorilla God ' + (currentGods.length + 1))) : ('Visitor ' + slot),
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
                    p.name = cleanGodName || ('Gorilla God ' + (currentGods.length + 1));
                    p.color = GOD_COLORS[currentGods.length % 4];
                }
            } else if (isGod && p.isGod && cleanGodName) {
                p.name = cleanGodName;
            } else if (!isGod && p.isGod) {
                p.isGod = false;
                p.name = 'Visitor ' + p.slot;
                p.color = '#fde047';
            }
            p.lastSeen = now;
        }
    }

    res.json({
        gods: Object.values(activePlayers),
        npcs: npcs,
        worldCount: worldItems.length,
        sportsScores
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
    res.json({ items: worldItems, npcs: npcs, sportsScores });
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
    const { id, isOpen, inventory, assignedTo, merchantSkin, shopItems, merchantName, signText, signColor, signBg, lastUrl } = req.body || {};
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

    saveAllToDisk();
    res.json({ success: true, item: target, npcs });
});

// Spawn New Companion Animal
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
        vx: 0,
        vz: 0,
        rotY: 0,
        targetX: startX + 20,
        targetZ: startZ - 20,
        stuckTicks: 0,
        waveUntil: 0,
        savedActivity: 'Roaming Town',
        wallet: 200,
        inventory: ['🍎 Welcome Apple', '🧃 Berry Juice'],
        mood: 'Excited 🎉',
        hunger: 90,
        energy: 95,
        activity: 'Roaming Town',
        assignedBedId: null,
        wants: ['Make friends with Peanut 🐼', 'Check out a Cooking Book 📚', 'Play Arcade Games 🕹️'],
        diary: ['Dear Diary: Today I arrived in The Badabing! I have $200 in my wallet!'],
        activityLog: ['[' + new Date().toLocaleTimeString() + '] Spawned as a cute ' + species + '!']
    };
    npcs.push(newCompanion);
    saveAllToDisk();
    res.json({ success: true, companion: newCompanion, npcs });
});

// Delete Companion Animal
app.post('/api/npcs/delete', (req, res) => {
    const { id } = req.body || {};
    if (!id || id === 'peanut') {
        return res.status(400).json({ error: 'Peanut is the town founder and cannot be deleted!' });
    }
    npcs = npcs.filter(n => n.id !== id);
    worldItems.forEach(it => {
        if (it.assignedTo === id) it.assignedTo = null;
    });
    saveAllToDisk();
    res.json({ success: true, npcs });
});

// Companion Actions (1-Second Wave + Resume, Library Book Checkout, Feed, Buy, etc.)
app.post('/api/npcs/action', (req, res) => {
    const { npcId, actionType, itemName, itemPrice, slotIndex, amount, playerX, playerZ, bookTitle, bookCategory } = req.body || {};
    const npc = npcs.find(n => n.id === npcId) || npcs[0];
    if (!npc) return res.status(404).json({ error: 'NPC not found' });

    if (typeof npc.wallet !== 'number') npc.wallet = 200;
    if (!Array.isArray(npc.inventory)) npc.inventory = [];

    if (actionType === 'wave') {
        if (!npc.activity.includes('Waving')) {
            npc.savedActivity = npc.activity;
        }
        // Wave for 1 second (1000ms), then automatically resume previous activity!
        npc.waveUntil = Date.now() + 1000;
        npc.mood = 'Happy 👋✨';
        npc.activity = 'Waving Back! 👋';
        if (typeof playerX === 'number' && typeof playerZ === 'number') {
            npc.rotY = +(Math.atan2(playerX - npc.x, playerZ - npc.z)).toFixed(2);
        }
        addLog(npc, 'Waved for a second and resumed ' + (npc.savedActivity || 'roaming') + '.');
        addDiary(npc, 'Someone waved at me! I gave them a quick wave and kept going!');
    } else if (actionType === 'checkout_book') {
        const title = bookTitle || '📖 Cooking Book';
        npc.inventory.push(title);
        npc.mood = 'Inspired 📚✨';
        npc.activity = 'Reading ' + title;
        npc.savedActivity = npc.activity;
        addDiary(npc, 'Checked out "' + title + '" (' + (bookCategory || 'Cooking') + ') from the Town Library!');
        addLog(npc, 'Checked out library book: ' + title);
    } else if (actionType === 'feed') {
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
    } else if (actionType === 'add_funds') {
        const bonus = Number(amount) || 50;
        npc.wallet += bonus;
        addLog(npc, 'Received +$' + bonus + ' allowance from a Gorilla God!');
        addDiary(npc, 'My wallet just got $' + bonus + ' richer!');
    } else if (actionType === 'use_item') {
        const idx = Number(slotIndex);
        if (idx >= 0 && idx < npc.inventory.length) {
            const used = npc.inventory.splice(idx, 1)[0];
            npc.hunger = Math.min(100, npc.hunger + 30);
            npc.energy = Math.min(100, npc.energy + 25);
            npc.mood = 'Delighted 🌟';
            npc.activity = 'Used ' + used;
            addLog(npc, 'Used ' + used + ' from personal backpack.');
            addDiary(npc, 'Enjoyed my ' + used + ' from my bag!');
        }
    } else if (actionType === 'buy') {
        const price = Number(itemPrice) || 0;
        if (npc.wallet < price) {
            return res.status(400).json({ error: npc.name + ' only has $' + npc.wallet + ' in their wallet!' });
        }
        npc.wallet -= price;
        npc.inventory.push(itemName || '🎁 Mystery Item');
        npc.hunger = Math.min(100, npc.hunger + 25);
        npc.energy = Math.min(100, npc.energy + 20);
        npc.mood = 'Spoiled & Joyful 🛍️';
        npc.activity = 'Carrying ' + (itemName || 'Gift');
        addDiary(npc, 'Bought ' + (itemName || 'a gift') + ' for $' + price + '! Still have $' + npc.wallet + ' left.');
        addLog(npc, 'Purchased ' + (itemName || 'item') + ' ($' + price + ') -> Added to Bag.');
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
