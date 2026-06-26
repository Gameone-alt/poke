// Backend URL: always use same origin — Vercel proxies /socket.io/ to Render in production
const BACKEND_URL = '';

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
  
  const channelId = document.getElementById('login-channel').value.trim();
  const password = document.getElementById('login-password').value.trim();
  
  if (!channelId || !password) {
    showFeedback('Please fill out all fields.');
    return;
  }
  
  showFeedback('Authenticating...', true);
  
  // Establish room-scoped connection
  const socket = io(BACKEND_URL, {
    query: { channelId },
    forceNew: true
  });
  
  socket.on('connect', () => {
    socket.emit('verify_password', { password });
  });

  socket.on('password_verified', (data) => {
    if (data.success) {
      // Save password and redirect
      localStorage.setItem('admin_password_' + channelId, password);
      showFeedback('Logged in successfully! Redirecting...', true);
      setTimeout(() => {
        window.location.href = `dashboard.html?channel=${channelId}`;
      }, 800);
    } else {
      showFeedback(data.message || 'Incorrect password for this channel.');
      socket.disconnect();
    }
  });
});

// Register handler
registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  clearFeedback();
  
  const channelId = document.getElementById('register-channel').value.trim();
  const password = document.getElementById('register-password').value.trim();
  
  if (!channelId || !password) {
    showFeedback('Please fill out all fields.');
    return;
  }
  
  showFeedback('Checking availability...', true);
  
  // Establish room connection to query status
  const socket = io(BACKEND_URL, {
    query: { channelId },
    forceNew: true
  });
  
  socket.on('password_status', (data) => {
    if (data.hasPassword) {
      showFeedback('This channel ID is already registered! Please log in instead.');
      socket.disconnect();
    } else {
      showFeedback('Creating your dashboard...', true);
      socket.emit('set_password', { password });
    }
  });

  socket.on('password_verified', (data) => {
    if (data.success) {
      // Save password and redirect
      localStorage.setItem('admin_password_' + channelId, password);
      showFeedback('Account created successfully! Launching dashboard...', true);
      setTimeout(() => {
        window.location.href = `dashboard.html?channel=${channelId}`;
      }, 800);
    } else {
      showFeedback(data.message || 'Error creating account.');
      socket.disconnect();
    }
  });
});
