const socket = io();

const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-subtitle');
const authBtn = document.getElementById('auth-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loggedInUserSpan = document.getElementById('logged-in-user');
const logoutBtn = document.getElementById('logout-btn');

const taskForm = document.getElementById('task-form');
const formTitle = document.getElementById('form-title');
const taskIdInput = document.getElementById('task-id');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const statusInput = document.getElementById('status');
const saveTaskBtn = document.getElementById('save-task-btn');
const tasksList = document.getElementById('tasks-list');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');

const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statCompleted = document.getElementById('stat-completed');

let isLoginMode = true;
let token = localStorage.getItem('token') || '';
let currentUser = localStorage.getItem('username') || '';
let allTasks = [];

if (token) {
    showDashboard();
}

// Toggle Login/Register
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'switch-mode') {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        authBtn.textContent = isLoginMode ? 'Login' : 'Register';
        authTitle.textContent = isLoginMode ? 'Sign in to manage your workflow' : 'Create a new account';
        authSwitchText.innerHTML = isLoginMode 
            ? `Don't have an account? <a href="#" id="switch-mode">Register</a>`
            : `Already have an account? <a href="#" id="switch-mode">Login</a>`;
    }
});

// Auth Submit
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Auth failed');

        if (isLoginMode) {
            token = data.token;
            currentUser = data.username;
            localStorage.setItem('token', token);
            localStorage.setItem('username', currentUser);
            showDashboard();
        } else {
            alert('Registration successful! Please login now.');
            isLoginMode = true;
            authBtn.textContent = 'Login';
            authTitle.textContent = 'Sign in to manage your workflow';
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
    loggedInUserSpan.textContent = `👤 ${currentUser}`;
    fetchTasks();
}

async function fetchTasks() {
    try {
        const res = await fetch('/api/tasks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                logoutBtn.click(); // Token expired or invalid
                return;
            }
            throw new Error('Failed to fetch tasks');
        }
        allTasks = await res.json();
        filterAndRenderTasks();
    } catch (err) {
        console.error(err);
    }
}

// Render Tasks & Stats
function filterAndRenderTasks() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusFilter = filterStatus.value;

    const filtered = allTasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchTerm) || (task.description && task.description.toLowerCase().includes(searchTerm));
        const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    statTotal.textContent = allTasks.length;
    statPending.textContent = allTasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
    statCompleted.textContent = allTasks.filter(t => t.status === 'Completed').length;

    tasksList.innerHTML = '';
    if (filtered.length === 0) {
        tasksList.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 40px;">No tasks found.</p>';
        return;
    }

    filtered.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card';
        let statusClass = 'status-pending';
        if (task.status === 'In Progress') statusClass = 'status-in-progress';
        if (task.status === 'Completed') statusClass = 'status-completed';

        card.innerHTML = `
            <div>
                <span class="status-badge ${statusClass}">${task.status}</span>
                <h4 style="margin-top: 10px;">${task.title}</h4>
                <p>${task.description || 'No description provided.'}</p>
            </div>
            <div class="task-actions">
                <button class="btn btn-edit" onclick="editTask('${task._id}', '${escapeAttr(task.title)}', '${escapeAttr(task.description || '')}', '${task.status}')">Edit</button>
                <button class="btn btn-delete" onclick="deleteTask('${task._id}')">Delete</button>
            </div>
        `;
        tasksList.appendChild(card);
    });
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

if (searchInput) searchInput.addEventListener('input', filterAndRenderTasks);
if (filterStatus) filterStatus.addEventListener('change', filterAndRenderTasks);

// Create / Update Task
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
        formTitle.textContent = '✨ Add New Task';
        saveTaskBtn.textContent = 'Create Task';
        fetchTasks();
    } catch (err) {
        alert(err.message);
    }
});

window.editTask = function(id, title, description, status) {
    taskIdInput.value = id;
    titleInput.value = title;
    descriptionInput.value = description;
    statusInput.value = status;
    formTitle.textContent = '✏️ Edit Task';
    saveTaskBtn.textContent = 'Update Task';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.deleteTask = async function(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete');
        fetchTasks();
    } catch (err) {
        alert(err.message);
    }
}

socket.on('taskCreated', () => fetchTasks());
socket.on('taskUpdated', () => fetchTasks());
socket.on('taskDeleted', () => fetchTasks());