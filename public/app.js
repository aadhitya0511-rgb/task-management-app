const socket = io();
const API_URL = ''; // Relative path since frontend is served from backend

let token = localStorage.getItem('token') || '';

// DOM Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');

// Check initial auth state
if (token) {
    showDashboard();
}

function showDashboard() {
    authSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    fetchTasks();
}

// Register
registerBtn.addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email: username + '@test.com', password })
    });
    const data = await res.json();
    alert(data.message || data.error);
});

// Login
loginBtn.addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) {
        token = data.token;
        localStorage.setItem('token', token);
        showDashboard();
    } else {
        alert(data.error);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    token = '';
    localStorage.removeItem('token');
    dashboardSection.style.display = 'none';
    authSection.style.display = 'block';
});

// Fetch Tasks
async function fetchTasks() {
    const res = await fetch('/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const tasks = await res.json();
    taskList.innerHTML = tasks.map(task => `
        <div class="card" style="margin:0;">
            <h3>${task.title}</h3>
            <p>${task.description || ''}</p>
            <p><small>Due: ${new Date(task.dueDate).toLocaleDateString()}</small></p>
            <button onclick="deleteTask('${task._id}')" style="background-color: #dc2626;">Delete</button>
        </div>
    `).join('');
}

// Add Task
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-desc').value;
    const dueDate = document.getElementById('task-date').value;

    await fetch('/api/tasks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, description, dueDate })
    });

    taskForm.reset();
});

// Delete Task
async function deleteTask(id) {
    await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
}

// Real-time listener via WebSockets
socket.on('taskUpdated', () => {
    if (token) fetchTasks();
});