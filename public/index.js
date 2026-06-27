// Backend URL: empty on localhost (same-origin Express), Render URL in production
const BACKEND_URL = window.location.origin.includes('localhost') ? '' : 'https://pokemon-overlay-backend-hfpf.onrender.com';

// DOM References
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const feedbackMsg = document.getElementById('portal-feedback');

// Tab toggling logic
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  clearFeedback();
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  clearFeedback();
});

function showFeedback(text, isSuccess = false) {
  feedbackMsg.textContent = text;
  feedbackMsg.className = `feedback-msg ${isSuccess ? 'success' : 'error'}`;
}

function clearFeedback() {
  feedbackMsg.textContent = '';
  feedbackMsg.className = 'feedback-msg';
}

// Log In handler
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  clearFeedback();
  
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  
  if (!username || !password) {
    showFeedback('Please fill out all fields.');
    return;
  }
  
  showFeedback('Authenticating...', true);
  
  // Use username as the channelId internally
  const channelId = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  
  const socket = io(BACKEND_URL, {
    query: { channelId },
    forceNew: true
  });
  
  socket.on('connect', () => {
    socket.emit('verify_password', { password });
  });

  socket.on('password_verified', (data) => {
    if (data.success) {
      localStorage.setItem('admin_password_' + channelId, password);
      showFeedback('Logged in successfully! Redirecting...', true);
      setTimeout(() => {
        window.location.href = `dashboard.html?channel=${channelId}`;
      }, 800);
    } else {
      showFeedback(data.message || 'Incorrect username or password.');
      socket.disconnect();
    }
  });

  socket.on('connect_error', () => {
    showFeedback('Cannot connect to server. Please try again later.');
  });
});

// Register handler
registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  clearFeedback();
  
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value.trim();
  const confirmPassword = document.getElementById('register-confirm-password').value.trim();
  
  if (!username || !password || !confirmPassword) {
    showFeedback('Please fill out all fields.');
    return;
  }

  if (username.length < 3) {
    showFeedback('Username must be at least 3 characters.');
    return;
  }
  
  if (password.length < 4) {
    showFeedback('Password must be at least 4 characters.');
    return;
  }
  
  if (password !== confirmPassword) {
    showFeedback('Passwords do not match.');
    return;
  }
  
  showFeedback('Creating your account...', true);
  
  const channelId = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  
  const socket = io(BACKEND_URL, {
    query: { channelId },
    forceNew: true
  });
  
  socket.once('password_status', (data) => {
    if (data.hasPassword) {
      showFeedback('This username is already taken! Please choose another or log in.');
      socket.disconnect();
    } else {
      socket.emit('set_password', { password });
    }
  });

  socket.on('password_verified', (data) => {
    if (data.success) {
      localStorage.setItem('admin_password_' + channelId, password);
      showFeedback('Account created! Launching dashboard...', true);
      setTimeout(() => {
        window.location.href = `dashboard.html?channel=${channelId}`;
      }, 800);
    } else {
      showFeedback(data.message || 'Error creating account. Please try again.');
      socket.disconnect();
    }
  });

  socket.on('connect_error', () => {
    showFeedback('Cannot connect to server. Please try again later.');
  });
});
