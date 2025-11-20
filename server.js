const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Data storage directories
const DATA_DIR = path.join(__dirname, 'data');
// Use /tmp for uploads on Render (only writable directory)
const UPLOADS_DIR = process.env.NODE_ENV === 'production' 
    ? '/tmp/uploads' 
    : path.join(__dirname, 'public', 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');

// Create directories if they don't exist
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

console.log('Uploads directory:', UPLOADS_DIR);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed!'));
        }
    }
});

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// Initialize data files
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
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultAdmin, null, 2));
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
                registrations: 0
            }
        ];
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(defaultEvents, null, 2));
    }

    if (!fs.existsSync(GALLERY_FILE)) {
        fs.writeFileSync(GALLERY_FILE, JSON.stringify([], null, 2));
    }

    if (!fs.existsSync(MESSAGES_FILE)) {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
    }

    if (!fs.existsSync(REGISTRATIONS_FILE)) {
        fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify({}, null, 2));
    }
}

initializeDataFiles();

// Helper functions
function readData(file) {
    try {
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

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Middleware to verify admin access
function verifyAdmin(req, res, next) {
    const users = readData(USERS_FILE);
    const user = users[req.user.email];
    
    if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ==================== AUTH ROUTES ====================

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const users = readData(USERS_FILE);

        if (users[email]) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        users[email] = {
            name,
            email,
            phone,
            password: hashedPassword,
            isAdmin: false,
            memberSince: new Date().toISOString()
        };

        writeData(USERS_FILE, users);
        res.json({ message: 'Account created successfully', email });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = readData(USERS_FILE);
        const user = users[email];

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

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
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    const users = readData(USERS_FILE);
    const user = users[req.user.email];
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin
    });
});

// ==================== EVENTS ROUTES ====================

app.get('/api/events', (req, res) => {
    const events = readData(EVENTS_FILE);
    res.json(events);
});

app.post('/api/events', authenticateToken, verifyAdmin, (req, res) => {
    const events = readData(EVENTS_FILE);
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
    const events = readData(EVENTS_FILE);
    const index = events.findIndex(e => e.id === parseInt(req.params.id));
    
    if (index === -1) {
        return res.status(404).json({ error: 'Event not found' });
    }
    
    events[index] = { ...events[index], ...req.body };
    writeData(EVENTS_FILE, events);
    res.json(events[index]);
});

app.delete('/api/events/:id', authenticateToken, verifyAdmin, (req, res) => {
    let events = readData(EVENTS_FILE);
    events = events.filter(e => e.id !== parseInt(req.params.id));
    writeData(EVENTS_FILE, events);
    res.json({ message: 'Event deleted' });
});

app.post('/api/events/:id/register', authenticateToken, (req, res) => {
    const events = readData(EVENTS_FILE);
    const registrations = readData(REGISTRATIONS_FILE);
    const eventId = parseInt(req.params.id);
    const userEmail = req.user.email;

    const event = events.find(e => e.id === eventId);
    if (!event) {
        return res.status(404).json({ error: 'Event not found' });
    }

    if (!registrations[eventId]) {
        registrations[eventId] = [];
    }

    if (registrations[eventId].includes(userEmail)) {
        return res.status(400).json({ error: 'Already registered for this event' });
    }

    registrations[eventId].push(userEmail);
    event.registrations = registrations[eventId].length;

    writeData(REGISTRATIONS_FILE, registrations);
    writeData(EVENTS_FILE, events);

    res.json({ message: 'Successfully registered for event', event });
});

// ==================== GALLERY ROUTES WITH BASE64 STORAGE ====================

app.get('/api/gallery', (req, res) => {
    const gallery = readData(GALLERY_FILE);
    res.json(gallery);
});

// Upload photo/video (Base64)
app.post('/api/gallery/upload', authenticateToken, verifyAdmin, (req, res) => {
    try {
        const { title, description, category, fileData, fileType, mimeType } = req.body;

        if (!fileData || !title || !description || !category) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const gallery = readData(GALLERY_FILE);
        
        const newItem = {
            id: gallery.length > 0 ? Math.max(...gallery.map(p => p.id)) + 1 : 1,
            title,
            description,
            category,
            type: fileType,
            mimeType,
            data: fileData, // Base64 encoded
            uploadedBy: req.user.email,
            uploadedAt: new Date().toISOString()
        };
        
        gallery.push(newItem);
        writeData(GALLERY_FILE, gallery);
        res.json(newItem);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Error uploading file' });
    }
});

// Delete photo/video
app.delete('/api/gallery/:id', authenticateToken, verifyAdmin, (req, res) => {
    let gallery = readData(GALLERY_FILE);
    gallery = gallery.filter(p => p.id !== parseInt(req.params.id));
    writeData(GALLERY_FILE, gallery);
    res.json({ message: 'Item deleted' });
});

// ==================== CONTACT MESSAGES ROUTES WITH FAQ ====================

app.post('/api/contact', (req, res) => {
    const messages = readData(MESSAGES_FILE);
    const newMessage = {
        id: messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1,
        ...req.body,
        date: new Date().toISOString(),
        read: false,
        likes: 0
    };
    
    messages.push(newMessage);
    writeData(MESSAGES_FILE, messages);
    res.json({ message: 'Message sent successfully' });
});

// Get top 20 liked FAQs (public)
app.get('/api/faqs', (req, res) => {
    const messages = readData(MESSAGES_FILE);
    
    // Sort by likes (descending) and get top 20
    const topFAQs = messages
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 20)
        .map(m => ({
            id: m.id,
            name: m.name,
            subject: m.subject,
            message: m.message,
            date: m.date,
            likes: m.likes || 0
        }));
    
    res.json(topFAQs);
});

// Like a question (public)
app.post('/api/faqs/:id/like', (req, res) => {
    const messages = readData(MESSAGES_FILE);
    const message = messages.find(m => m.id === parseInt(req.params.id));
    
    if (!message) {
        return res.status(404).json({ error: 'Message not found' });
    }
    
    message.likes = (message.likes || 0) + 1;
    writeData(MESSAGES_FILE, messages);
    res.json({ likes: message.likes });
});

app.get('/api/contact', authenticateToken, verifyAdmin, (req, res) => {
    const messages = readData(MESSAGES_FILE);
    res.json(messages);
});

app.put('/api/contact/:id/read', authenticateToken, verifyAdmin, (req, res) => {
    const messages = readData(MESSAGES_FILE);
    const message = messages.find(m => m.id === parseInt(req.params.id));
    
    if (!message) {
        return res.status(404).json({ error: 'Message not found' });
    }
    
    message.read = true;
    writeData(MESSAGES_FILE, messages);
    res.json(message);
});

app.delete('/api/contact/:id', authenticateToken, verifyAdmin, (req, res) => {
    let messages = readData(MESSAGES_FILE);
    messages = messages.filter(m => m.id !== parseInt(req.params.id));
    writeData(MESSAGES_FILE, messages);
    res.json({ message: 'Message deleted' });
});

// ==================== USERS ROUTES ====================

app.get('/api/users', authenticateToken, verifyAdmin, (req, res) => {
    const users = readData(USERS_FILE);
    const userList = Object.values(users).map(u => ({
        name: u.name,
        email: u.email,
        phone: u.phone,
        isAdmin: u.isAdmin,
        memberSince: u.memberSince
    }));
    res.json(userList);
});

app.post('/api/users/grant-admin', authenticateToken, verifyAdmin, (req, res) => {
    const { email } = req.body;
    const users = readData(USERS_FILE);
    
    if (!users[email]) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    users[email].isAdmin = true;
    writeData(USERS_FILE, users);
    res.json({ message: 'Admin access granted' });
});

app.post('/api/users/revoke-admin', authenticateToken, verifyAdmin, (req, res) => {
    const { email } = req.body;
    const users = readData(USERS_FILE);
    
    if (email === 'abhinav.reddivari@gmail.com') {
        return res.status(403).json({ error: 'Cannot revoke primary admin access' });
    }
    
    if (!users[email]) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    users[email].isAdmin = false;
    writeData(USERS_FILE, users);
    res.json({ message: 'Admin access revoked' });
});

app.delete('/api/users/:email', authenticateToken, verifyAdmin, (req, res) => {
    const email = req.params.email;
    
    if (email === 'abhinav.reddivari@gmail.com') {
        return res.status(403).json({ error: 'Cannot delete primary admin' });
    }
    
    const users = readData(USERS_FILE);
    delete users[email];
    writeData(USERS_FILE, users);
    res.json({ message: 'User deleted' });
});

// ==================== STATS ROUTES ====================

app.get('/api/stats', authenticateToken, verifyAdmin, (req, res) => {
    const users = readData(USERS_FILE);
    const events = readData(EVENTS_FILE);
    const gallery = readData(GALLERY_FILE);
    const messages = readData(MESSAGES_FILE);
    
    res.json({
        totalMembers: Object.keys(users).length,
        totalEvents: events.length,
        totalPhotos: gallery.length,
        unreadMessages: messages.filter(m => !m.read).length
    });
});

// Serve static files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 KTA Server running on port ${PORT}`);
    console.log(`📧 Default admin: abhinav.reddivari@gmail.com`);
    console.log(`🔑 Default password: admin123`);
    console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);
});
