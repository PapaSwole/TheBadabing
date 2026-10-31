const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'world_data.json');

app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Persistent World State
let worldItems = [];
if (fs.existsSync(DATA_FILE)) {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed)) worldItems = parsed;
    } catch (e) {
        console.error('Error loading world_data.json:', e);
    }
} else {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
}

function saveWorldToDisk() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(worldItems, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed saving world_data.json:', e);
    }
}

// Active Co-Op Gods (Max 4 concurrent slots)
const gods = {}; // id -> { id, name, color, x, y, z, ry, lastSeen }
const GOD_SLOTS = [
    { name: 'God 1 (Host)', color: '#38bdf8' },
    { name: 'God 2', color: '#4ade80' },
    { name: 'God 3', color: '#f43f5e' },
    { name: 'God 4', color: '#a855f7' }
];

// Prune disconnected Gods after 12 seconds of inactivity
setInterval(() => {
    const now = Date.now();
    Object.keys(gods).forEach(id => {
        if (now - gods[id].lastSeen > 12000) {
            delete gods[id];
        }
    });
}, 4000);

// Real-time Co-Op Sync Endpoint
app.post('/api/sync', (req, res) => {
    const { id, x, y, z, ry } = req.body;
    if (id) {
        if (!gods[id]) {
            const activeCount = Object.keys(gods).length;
            if (activeCount < 4) {
                const usedNames = Object.values(gods).map(g => g.name);
                const slot = GOD_SLOTS.find(s => !usedNames.includes(s.name)) || GOD_SLOTS[0];
                gods[id] = {
                    id,
                    name: slot.name,
                    color: slot.color,
                    x: x || 0,
                    y: y || 3,
                    z: z || 20,
                    ry: ry || 0,
                    lastSeen: Date.now()
                };
            }
        } else {
            gods[id].x = typeof x === 'number' ? x : gods[id].x;
            gods[id].y = typeof y === 'number' ? y : gods[id].y;
            gods[id].z = typeof z === 'number' ? z : gods[id].z;
            gods[id].ry = typeof ry === 'number' ? ry : gods[id].ry;
            gods[id].lastSeen = Date.now();
        }
    }
    res.json({
        gods: Object.values(gods),
        itemCount: worldItems.length
    });
});

// Load World Pieces
app.get('/api/world', (req, res) => {
    res.json(worldItems);
});

// Save Full World Array (Place / Dismantle / Door Toggle / Inventory / Bed Assign)
app.post('/api/world', (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Expected array of world items' });
    }
    worldItems = req.body;
    saveWorldToDisk();
    res.json({ success: true, count: worldItems.length });
});

// Universal Fallback Route
app.use((req, res) => {
    const rootIndex = path.join(__dirname, 'index.html');
    const publicIndex = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
    if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
    res.status(404).send('index.html not found');
});

app.listen(PORT, () => {
    console.log('The Badabing Co-Op Server running on port ' + PORT);
});