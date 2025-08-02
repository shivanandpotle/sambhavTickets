document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginErrorDiv = document.getElementById('loginError');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginErrorDiv.style.display = 'none';
        loginErrorDiv.className = 'form-message error';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.success) {
                window.location.href = '/admin';
            } else {
                loginErrorDiv.textContent = result.message || 'Invalid username or password.';
                loginErrorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginErrorDiv.textContent = 'An error occurred. Please try again.';
            loginErrorDiv.style.display = 'block';
        }
    });
});