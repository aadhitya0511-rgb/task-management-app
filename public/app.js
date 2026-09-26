const API_URL = '/api';

// DOM Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authBtn = document.getElementById('auth-btn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loggedInUserSpan = document.getElementById('logged-in-user');
const logoutBtn = document.getElementById('logout-btn');

const taskForm = document.getElementById('task-form');
const formTitle = document.getElementById('form-title');
const taskIdInput = document.getElementById('task-id');
const taskTitleInput = document.getElementById('title');
const taskDescInput = document.getElementById('description');
const taskStatusInput = document.getElementById('status');
const saveTaskBtn = document.getElementById('save-task-btn');
const tasksList = document.getElementById('tasks-list');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');

const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statCompleted = document.getElementById('stat-completed');
const authTitle = document.getElementById('auth-subtitle');
const authSwitchText = document.getElementById('auth-switch-text');
const switchModeBtn = document.getElementById('switch-mode');

let isLoginMode = true;
let tasks = [];

// Socket.io connection
const socket = io();

socket.on('taskCreated', (task) => {
    tasks.push(task);
    renderTasks();
});

socket.on('taskUpdated', (updatedTask) => {
    tasks = tasks.map(t => t._id === updatedTask._id ? updatedTask : t);
    renderTasks();
});

socket.on('taskDeleted', (deletedId) => {
    tasks = tasks.filter(t => t._id !== deletedId);
    renderTasks();
});

// Mode Switcher
if (switchModeBtn) {
    switchModeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            authTitle.textContent = 'Sign in to manage your workflow';
            authBtn.textContent = 'Login';
            authSwitchText.innerHTML = 'Don\'t have an account? <a href="#" id="switch-mode">Register</a>';
        } else {
            authTitle.textContent = 'Create an account to get started';
            authBtn.textContent = 'Register';
            authSwitchText.innerHTML = 'Already have an account? <a href="#" id="switch-mode">Login</a>';
        }
        // Re-bind switch listener
        setTimeout(() => {
            const newSwitch = document.getElementById('switch-mode');
            if (newSwitch) newSwitch.addEventListener('click', arguments.callee);
        }, 100);
    });
}

// Direct Button Click Handler (Bypasses Extension Form Interception)
authBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        alert('Please enter both username and password.');
        return;
    }

    const endpoint = isLoginMode ? `${API_URL}/auth/login` : `${API_URL}/auth/register`;

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Authentication failed');

        if (isLoginMode) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            
            // Force direct inline style transition (ignores extensions & CSS classes)
            authSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            dashboardSection.classList.remove('hidden');
            authSection.classList.add('hidden');
            
            loggedInUserSpan.textContent = `👤 ${data.username}`;
            fetchTasks();
        } else {
            alert('Registration successful! Please login.');
            isLoginMode = true;
            authTitle.textContent = 'Sign in to manage your workflow';
            authBtn.textContent = 'Login';
            authSwitchText.innerHTML = 'Don\'t have an account? <a href="#" id="switch-mode">Register</a>';
        }
    } catch (err) {
        alert(err.message);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    authSection.style.display = 'flex';
    dashboardSection.style.display = 'none';
    usernameInput.value = '';
    passwordInput.value = '';
});

// Check Auth on Load
function checkAuth() {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (token && username) {
        authSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        dashboardSection.classList.remove('hidden');
        authSection.classList.add('hidden');
        loggedInUserSpan.textContent = `👤 ${username}`;
        fetchTasks();
    } else {
        authSection.style.display = 'flex';
        dashboardSection.style.display = 'none';
    }
}

// Fetch Tasks
async function fetchTasks() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/tasks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            checkAuth();
            return;
        }
        tasks = await res.json();
        renderTasks();
    } catch (err) {
        console.error(err);
    }
}

// Task Form Submit
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const id = taskIdInput.value;
    const title = taskTitleInput.value.trim();
    const description = taskDescInput.value.trim();
    const status = taskStatusInput.value;

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/tasks/${id}` : `${API_URL}/tasks`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, description, status })
        });

        if (!res.ok) throw new Error('Failed to save task');

        resetTaskForm();
        fetchTasks();
    } catch (err) {
        alert(err.message);
    }
});

// Render Tasks
function renderTasks() {
    const searchQuery = searchInput.value.toLowerCase();
    const selectedFilter = filterStatus.value;

    const filtered = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery) || (task.description && task.description.toLowerCase().includes(searchQuery));
        const matchesFilter = selectedFilter === 'All' || task.status === selectedFilter;
        return matchesSearch && matchesFilter;
    });

    statTotal.textContent = tasks.length;
    statPending.textContent = tasks.filter(t => t.status === 'Pending').length;
    statCompleted.textContent = tasks.filter(t => t.status === 'Completed').length;

    tasksList.innerHTML = '';
    if (filtered.length === 0) {
        tasksList.innerHTML = `<p class="no-tasks">No tasks found.</p>`;
        return;
    }

    filtered.forEach(task => {
        const card = document.createElement('div');
        card.className = `task-card ${task.status.toLowerCase().replace(' ', '-')}`;
        card.innerHTML = `
            <div class="task-header">
                <h4>${escapeHtml(task.title)}</h4>
                <span class="badge ${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span>
            </div>
            <p class="task-desc">${escapeHtml(task.description || 'No description provided.')}</p>
            <div class="task-actions">
                <button onclick="editTask('${task._id}')" class="btn small edit">Edit</button>
                <button onclick="deleteTask('${task._id}')" class="btn small delete">Delete</button>
            </div>
        `;
        tasksList.appendChild(card);
    });
}

window.editTask = function(id) {
    const task = tasks.find(t => t._id === id);
    if (!task) return;
    taskIdInput.value = task._id;
    taskTitleInput.value = task.title;
    taskDescInput.value = task.description || '';
    taskStatusInput.value = task.status;
    formTitle.textContent = '✏️ Edit Task';
    saveTaskBtn.textContent = 'Update Task';
};

window.deleteTask = async function(id) {
    const token = localStorage.getItem('token');
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete task');
        fetchTasks();
    } catch (err) {
        alert(err.message);
    }
};

function resetTaskForm() {
    taskIdInput.value = '';
    taskTitleInput.value = '';
    taskDescInput.value = '';
    taskStatusInput.value = 'Pending';
    formTitle.textContent = '✨ Add New Task';
    saveTaskBtn.textContent = 'Create Task';
}

if (searchInput) searchInput.addEventListener('input', renderTasks);
if (filterStatus) filterStatus.addEventListener('change', renderTasks);

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

checkAuth();