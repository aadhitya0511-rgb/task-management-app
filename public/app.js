const socket = io();

const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authBtn = document.getElementById('auth-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loggedInUserSpan = document.getElementById('logged-in-user');
const logoutBtn = document.getElementById('logout-btn');

const taskForm = document.getElementById('task-form');
const taskIdInput = document.getElementById('task-id');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const statusInput = document.getElementById('status');
const saveTaskBtn = document.getElementById('save-task-btn');
const tasksList = document.getElementById('tasks-list');

let isLoginMode = true;
let token = localStorage.getItem('token') || '';
let currentUser = localStorage.getItem('username') || '';

// Initialize state
if (token) {
    showDashboard();
}

// Toggle between Login and Register using event delegation
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'switch-mode') {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        authTitle.textContent = isLoginMode ? 'Login' : 'Register';
        authBtn.textContent = isLoginMode ? 'Login' : 'Register';
        authSwitchText.innerHTML = isLoginMode 
            ? `Don't have an account? <a href="#" id="switch-mode">Register</a>`
            : `Already have an account? <a href="#" id="switch-mode">Login</a>`;
    }
});

// Handle Auth Submission
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value;
    const password = passwordInput.value;
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Authentication failed');

        if (isLoginMode) {
            token = data.token;
            currentUser = username;
            localStorage.setItem('token', token);
            localStorage.setItem('username', currentUser);
            showDashboard();
        } else {
            alert('Registration successful! Please login.');
            isLoginMode = true;
            authTitle.textContent = 'Login';
            authBtn.textContent = 'Login';
            authSwitchText.innerHTML = `Don't have an account? <a href="#" id="switch-mode">Register</a>`;
            authForm.reset();
        }
    } catch (err) {
        alert(err.message);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    token = '';
    currentUser = '';
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    authForm.reset();
});

function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    loggedInUserSpan.textContent = `Welcome, ${currentUser}`;
    fetchTasks();
}

// Fetch Tasks
async function fetchTasks() {
    try {
        const res = await fetch('/api/tasks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch tasks');
        const tasks = await res.json();
        renderTasks(tasks);
    } catch (err) {
        console.error('Error fetching tasks:', err);
    }
}

// Render Tasks
function renderTasks(tasks) {
    tasksList.innerHTML = '';
    if (tasks.length === 0) {
        tasksList.innerHTML = '<p>No tasks found. Create one above!</p>';
        return;
    }

    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.innerHTML = `
            <h4>${task.title}</h4>
            <p>${task.description || 'No description'}</p>
            <p><strong>Status:</strong> ${task.status}</p>
            <div class="task-actions">
                <button class="btn primary" onclick="editTask('${task._id}', '${escapeAttr(task.title)}', '${escapeAttr(task.description || '')}', '${task.status}')">Edit</button>
                <button class="btn danger" onclick="deleteTask('${task._id}')">Delete</button>
            </div>
        `;
        tasksList.appendChild(card);
    });
}

// Helper to escape quotes for inline onclick handlers
function escapeAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Create or Update Task
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = taskIdInput.value;
    const title = titleInput.value;
    const description = descriptionInput.value;
    const status = statusInput.value;

    const endpoint = id ? `/api/tasks/${id}` : '/api/tasks';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, description, status })
        });

        if (!res.ok) throw new Error('Failed to save task');

        taskForm.reset();
        taskIdInput.value = '';
        saveTaskBtn.textContent = 'Add Task';
        fetchTasks();
    } catch (err) {
        alert(err.message);
    }
});

// Edit Task Helper
window.editTask = function(id, title, description, status) {
    taskIdInput.value = id;
    titleInput.value = title;
    descriptionInput.value = description;
    statusInput.value = status;
    saveTaskBtn.textContent = 'Update Task';
}

// Delete Task
window.deleteTask = async function(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to delete task');
        fetchTasks();
    } catch (err) {
        alert(err.message);
    }
}

// Socket.io Real-time listeners
socket.on('taskCreated', () => fetchTasks());
socket.on('taskUpdated', () => fetchTasks());
socket.on('taskDeleted', () => fetchTasks());