const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'world_data.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Initialize world_data.json if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Load all player-placed modular structures
app.get('/api/world', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const data = JSON.parse(raw || '[]');
            return res.json(data);
        }
        res.json([]);
    } catch (err) {
        console.error('Error reading world_data.json:', err);
        res.json([]);
    }
});

// Save all player-placed modular structures permanently
app.post('/api/world', (req, res) => {
    try {
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ error: 'Expected array of build items' });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
        res.json({ success: true, count: req.body.length });
    } catch (err) {
        console.error('Error writing world_data.json:', err);
        res.status(500).json({ error: 'Failed to save world data' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('The Badabing Server running on port ' + PORT);
});