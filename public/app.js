// Auth Form Submit
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
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
            token = data.token;
            currentUser = data.username;
            localStorage.setItem('token', token);
            localStorage.setItem('username', currentUser);
            
            // Force immediate UI transition
            authSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            loggedInUserSpan.textContent = `👤 ${currentUser}`;
            fetchTasks();
        } else {
            alert('Registration successful! Please login.');
            isLoginMode = true;
            updateAuthUI();
        }
    } catch (err) {
        alert(err.message);
    }
});