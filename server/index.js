const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

// Middleware
app.use(cors());
app.use(express.json());

// Request Logger to debug routes
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// --- MONGODB MODELS ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});
const Task = mongoose.model('Task', taskSchema);

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// --- AUTHENTICATION ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
    username = username.trim().toLowerCase();

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Username already taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
    username = username.trim().toLowerCase();

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid username or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid username or password' });

    const token = jwt.sign(
      { id: user._id, username: user.username }, 
      process.env.JWT_SECRET || 'secretKey', 
      { expiresIn: '1d' }
    );
    
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

// --- JWT MIDDLEWARE ---
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied, token missing' });

  jwt.verify(token, process.env.JWT_SECRET || 'secretKey', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- TASK CRUD ROUTES ---
app.get('/api/tasks', verifyToken, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/tasks', verifyToken, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    const newTask = new Task({ title, description, status, user: req.user.id });
    await newTask.save();
    io.emit('taskCreated', newTask);
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/tasks/:id', verifyToken, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { title, description, status },
      { new: true }
    );
    if (!updatedTask) return res.status(404).json({ message: 'Task not found' });
    io.emit('taskUpdated', updatedTask);
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/tasks/:id', verifyToken, async (req, res) => {
  try {
    const deletedTask = await Task.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deletedTask) return res.status(404).json({ message: 'Task not found' });
    io.emit('taskDeleted', req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {});
});

// --- STATIC FILES & CATCH-ALL ---
app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});