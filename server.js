// server.js
// Slightly cleaned version of your server with clearer static routing and small hardening.

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static HTML files and assets from public

// Data storage file paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper read/write
function readData(file) {
    try {
        if (!fs.existsSync(file)) return null;
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${file}:`, error);
        return null;
    }
}

function writeData(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${file}:`, error);
        return false;
    }
}

// Initialize default files/data if missing (keeps existing files untouched)
function initializeDataFiles() {
    if (!fs.existsSync(USERS_FILE)) {
        const defaultAdmin = {
            'abhinav.reddivari@gmail.com': {
                name: 'Abhinav Reddivari',
                email: 'abhinav.reddivari@gmail.com',
                phone: '+60123456789',
                password: bcrypt.hashSync('admin123', 10),
                isAdmin: true,
                memberSince: new Date().toISOString()
            }
        };
        writeData(USERS_FILE, defaultAdmin);
    }

    if (!fs.existsSync(EVENTS_FILE)) {
        const defaultEvents = [
            {
                id: 1,
                name: 'Sankranti Festival 2026',
                date: '2026-01-14',
                time: '09:00',
                location: 'Community Hall, Klang',
                description: 'Grand celebration of the harvest festival',
                icon: '🪔',
                registrations: 0,
                createdAt: new Date().toISOString()
            }
        ];
        writeData(EVENTS_FILE, defaultEvents);
    }

    if (!fs.existsSync(GALLERY_FILE)) {
        const defaultGallery = [
            {
                id: 1,
                title: 'Sankranti 2025',
                description: 'Traditional harvest festival celebration',
                category: 'festivals',
                icon: '🪔',
                uploadedBy: 'admin',
                uploadedAt: new Date().toISOString()
            }
        ];
        writeData(GALLERY_FILE, defaultGallery);
    }

    if (!fs.existsSync(MESSAGES_FILE)) {
        writeData(MESSAGES_FILE, []);
    }

    if (!fs.existsSync(REGISTRATIONS_FILE)) {
        writeData(REGISTRATIONS_FILE, {});
    }
}
initializeDataFiles();

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = payload; // contains email
        next();
    });
}

function verifyAdmin(req, res, next) {
    const users = readData(USERS_FILE) || {};
    const user = users[req.user.email];
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
}

// ================= AUTH =================
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const users = readData(USERS_FILE) || {};
        if (users[email]) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        users[email] = {
            name: name || email.split('@')[0],
            email,
            phone: phone || '',
            password: hashedPassword,
            isAdmin: false,
            memberSince: new Date().toISOString()
        };
        writeData(USERS_FILE, users);
        res.json({ message: 'Account created successfully', email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = readData(USERS_FILE) || {};
        const user = users[email];
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                name: user.name,
                email: user.email,
                phone: user.phone,
                isAdmin: user.isAdmin
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    const users = readData(USERS_FILE) || {};
    const user = users[req.user.email];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ name: user.name, email: user.email, phone: user.phone, isAdmin: user.isAdmin });
});

// ================= EVENTS =================
app.get('/api/events', (req, res) => {
    const events = readData(EVENTS_FILE) || [];
    res.json(events);
});

app.post('/api/events', authenticateToken, verifyAdmin, (req, res) => {
    const events = readData(EVENTS_FILE) || [];
    const newEvent = {
        id: events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1,
        ...req.body,
        registrations: 0,
        createdAt: new Date().toISOString()
    };
    events.push(newEvent);
    writeData(EVENTS_FILE, events);
    res.json(newEvent);
});

app.put('/api/events/:id', authenticateToken, verifyAdmin, (req, res) => {
    const events = readData(EVENTS_FILE) || [];
    const id = parseInt(req.params.id, 10);
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Event not found' });
    events[idx] = { ...events[idx], ...req.body };
    writeData(EVENTS_FILE, events);
    res.json(events[idx]);
});

app.delete('/api/events/:id', authenticateToken, verifyAdmin, (req, res) => {
    const events = readData(EVENTS_FILE) || [];
    const id = parseInt(req.params.id, 10);
    const newEvents = events.filter(e => e.id !== id);
    writeData(EVENTS_FILE, newEvents);
    res.json({ message: 'Event deleted' });
});

app.post('/api/events/:id/register', authenticateToken, (req, res) => {
    const events = readData(EVENTS_FILE) || [];
    const registrations = readData(REGISTRATIONS_FILE) || {};
    const id = parseInt(req.params.id, 10);
    const event = events.find(e => e.id === id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (!registrations[id]) registrations[id] = [];
    if (registrations[id].includes(req.user.email)) return res.status(400).json({ error: 'Already registered' });

    registrations[id].push(req.user.email);
    event.registrations = registrations[id].length;

    writeData(REGISTRATIONS_FILE, registrations);
    writeData(EVENTS_FILE, events);
    res.json({ message: 'Registered', event });
});

// ================= GALLERY =================
app.get('/api/gallery', (req, res) => {
    const gallery = readData(GALLERY_FILE) || [];
    res.json(gallery);
});

app.post('/api/gallery', authenticateToken, verifyAdmin, (req, res) => {
    const gallery = readData(GALLERY_FILE) || [];
    const newPhoto = {
        id: gallery.length > 0 ? Math.max(...gallery.map(p => p.id)) + 1 : 1,
        ...req.body,
        uploadedBy: req.user.email,
        uploadedAt: new Date().toISOString()
    };
    gallery.push(newPhoto);
    writeData(GALLERY_FILE, gallery);
    res.json(newPhoto);
});

app.delete('/api/gallery/:id', authenticateToken, verifyAdmin, (req, res) => {
    const gallery = readData(GALLERY_FILE) || [];
    const id = parseInt(req.params.id, 10);
    const newGallery = gallery.filter(p => p.id !== id);
    writeData(GALLERY_FILE, newGallery);
    res.json({ message: 'Photo deleted' });
});

// ================= CONTACT =================
app.post('/api/contact', (req, res) => {
    const messages = readData(MESSAGES_FILE) || [];
    const newMessage = {
        id: messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1,
        ...req.body,
        date: new Date().toISOString(),
        read: false
    };
    messages.push(newMessage);
    writeData(MESSAGES_FILE, messages);
    res.json({ message: 'Message sent' });
});

app.get('/api/contact', authenticateToken, verifyAdmin, (req, res) => {
    const messages = readData(MESSAGES_FILE) || [];
    res.json(messages);
});

app.put('/api/contact/:id/read', authenticateToken, verifyAdmin, (req, res) => {
    const messages = readData(MESSAGES_FILE) || [];
    const id = parseInt(req.params.id, 10);
    const msg = messages.find(m => m.id === id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    msg.read = true;
    writeData(MESSAGES_FILE, messages);
    res.json(msg);
});

app.delete('/api/contact/:id', authenticateToken, verifyAdmin, (req, res) => {
    const messages = readData(MESSAGES_FILE) || [];
    const id = parseInt(req.params.id, 10);
    const newMessages = messages.filter(m => m.id !== id);
    writeData(MESSAGES_FILE, newMessages);
    res.json({ message: 'Message deleted' });
});

// ================= USERS / ADMINS =================
app.get('/api/users', authenticateToken, verifyAdmin, (req, res) => {
    const users = readData(USERS_FILE) || {};
    const list = Object.values(users).map(u => ({
        name: u.name, email: u.email, phone: u.phone, isAdmin: u.isAdmin, memberSince: u.memberSince
    }));
    res.json(list);
});

app.post('/api/users/grant-admin', authenticateToken, verifyAdmin, (req, res) => {
    const { email } = req.body;
    const users = readData(USERS_FILE) || {};
    if (!users[email]) return res.status(404).json({ error: 'User not found' });
    users[email].isAdmin = true;
    writeData(USERS_FILE, users);
    res.json({ message: 'Admin granted' });
});

app.post('/api/users/revoke-admin', authenticateToken, verifyAdmin, (req, res) => {
    const { email } = req.body;
    if (email === 'abhinav.reddivari@gmail.com') return res.status(403).json({ error: 'Cannot revoke primary admin' });
    const users = readData(USERS_FILE) || {};
    if (!users[email]) return res.status(404).json({ error: 'User not found' });
    users[email].isAdmin = false;
    writeData(USERS_FILE, users);
    res.json({ message: 'Admin revoked' });
});

app.delete('/api/users/:email', authenticateToken, verifyAdmin, (req, res) => {
    const email = req.params.email;
    if (email === 'abhinav.reddivari@gmail.com') return res.status(403).json({ error: 'Cannot delete primary admin' });
    const users = readData(USERS_FILE) || {};
    delete users[email];
    writeData(USERS_FILE, users);
    res.json({ message: 'User deleted' });
});

// ================= STATS =================
app.get('/api/stats', authenticateToken, verifyAdmin, (req, res) => {
    const users = readData(USERS_FILE) || {};
    const events = readData(EVENTS_FILE) || [];
    const gallery = readData(GALLERY_FILE) || [];
    const messages = readData(MESSAGES_FILE) || [];
    res.json({
        totalMembers: Object.keys(users).length,
        totalEvents: events.length,
        totalPhotos: gallery.length,
        unreadMessages: messages.filter(m => !m.read).length
    });
});

// Serve admin or index (let express.static serve actual files). As fallback, serve index.html
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(404).send('Not found');
});

// Start
app.listen(PORT, () => {
    console.log(`🚀 KTA Server running on port ${PORT}`);
    console.log(`📧 Default admin: abhinav.reddivari@gmail.com`);
    console.log(`🔑 Default password: admin123 (please change after first login)`);
});
