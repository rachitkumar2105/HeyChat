const backendURL = window.location.hostname === 'localhost' ? "http://localhost:5000" : ""; // In production, we assume relative path or set via another way
const socket = io(backendURL);
let currentUser = null;
let currentChat = null;
let token = localStorage.getItem("token");

// --- Auth ---

function showLogin() {
  document.getElementById("login-form").style.display = "block";
  document.getElementById("signup-form").style.display = "none";
}

function showSignup() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("signup-form").style.display = "block";
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      token = data.token;
      localStorage.setItem("token", token);
      currentUser = data.user;
      initApp();
    } else {
      document.getElementById("auth-error").innerText = data.error || data;
    }
  } catch (err) {
    console.error(err);
  }
});

document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const displayName = document.getElementById("signup-displayname").value;
  const username = document.getElementById("signup-username").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const errorEl = document.getElementById("auth-error");

  // Client-side Validation logic
  errorEl.innerText = ""; // Clear previous errors

  // 1. Email Validation
  if (!email.endsWith("@gmail.com")) {
    errorEl.innerText = "Email must be a valid @gmail.com address";
    return;
  }

  // 2. Password Complexity
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
  if (!passwordRegex.test(password)) {
    errorEl.innerText = "Password must contain at least 1 uppercase, 1 lowercase, and 1 number.";
    return;
  }

  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email, displayName })
  });

  if (res.ok) {
    alert("Signup successful! Please login.");
    showLogin();
  } else {
    errorEl.innerText = await res.text();
  }
});

function logout() {
  localStorage.removeItem("token");
  location.reload();
}

function initApp() {
  document.getElementById("auth-section").classList.add("hidden");
  if (currentUser.isAdmin) {
    document.getElementById("admin-section").classList.remove("hidden");
  } else {
    document.getElementById("chat-section").classList.remove("hidden");
    document.getElementById("current-user").innerText = currentUser.username;
    socket.emit("join", currentUser.id);
    loadContacts();
  }
}

// --- Chat Logic ---

async function loadContacts() {
  const res = await fetch(`/api/user/contacts/${currentUser.id}`);
  const data = await res.json();
  const list = document.getElementById("contacts-list");
  list.innerHTML = "";

  data.friends.forEach(friend => {
    const li = document.createElement("li");
    li.innerText = friend.username;
    li.onclick = () => openChat(friend);
    list.appendChild(li);
  });
}

function openChat(friend) {
  currentChat = friend;
  document.body.classList.add("chat-active"); // For mobile view
  document.getElementById("chat-header").classList.remove("hidden");

  // Add back button for mobile if not exists
  let backBtn = document.getElementById("back-btn");
  if (!backBtn) {
    backBtn = document.createElement("button");
    backBtn.id = "back-btn";
    backBtn.innerText = "←";
    backBtn.onclick = closeChat;
    backBtn.style.marginRight = "10px";
    document.getElementById("chat-header").prepend(backBtn);
  }

  document.getElementById("chat-controls").classList.remove("hidden");
  document.getElementById("chat-with").innerText = friend.username;
  document.getElementById("messages-container").innerHTML = "";
  // In a real app, fetch message history here
}

function closeChat() {
  currentChat = null;
  document.body.classList.remove("chat-active");
  document.getElementById("chat-header").classList.add("hidden");
  document.getElementById("chat-controls").classList.add("hidden");
}

function sendMessage() {
  const input = document.getElementById("message-input");
  const content = input.value;
  if (!content) return;

  const msg = {
    from: currentUser.id,
    to: currentChat._id,
    content,
    type: "text"
  };

  socket.emit("privateMessage", msg);
  appendMessage(msg, "sent");
  input.value = "";
}

async function uploadFile() {
  const fileInput = document.getElementById("file-input");
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (res.ok) {
    const msg = {
      from: currentUser.id,
      to: currentChat._id,
      content: "",
      type: data.type.startsWith("image") ? "image" : "video",
      fileUrl: data.fileUrl
    };
    socket.emit("privateMessage", msg);
    appendMessage(msg, "sent");
  }
}

function appendMessage(msg, type) {
  const container = document.getElementById("messages-container");
  const div = document.createElement("div");
  div.className = `message ${type}`;

  if (msg.type === "text") {
    div.innerText = msg.content;
  } else if (msg.type === "image") {
    const img = document.createElement("img");
    img.src = msg.fileUrl;
    div.appendChild(img);
  } else if (msg.type === "video") {
    const vid = document.createElement("video");
    vid.src = msg.fileUrl;
    vid.controls = true;
    div.appendChild(vid);
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

socket.on("receiveMessage", (msg) => {
  if (currentChat && msg.sender === currentChat._id) {
    appendMessage(msg, "received");
  } else {
    // Notify user of new message
    alert("New message from " + msg.sender);
  }
});

// --- Search & Requests ---

async function searchUsers() {
  const query = document.getElementById("user-search").value;
  const res = await fetch(`/api/user/search?query=${query}`);
  const users = await res.json();
  const list = document.getElementById("search-results");
  list.innerHTML = "";

  users.forEach(user => {
    if (user._id === currentUser.id) return;
    const div = document.createElement("div");
    div.innerText = user.username;
    const btn = document.createElement("button");
    btn.innerText = "Request";
    btn.onclick = () => sendRequest(user._id);
    div.appendChild(btn);
    list.appendChild(div);
  });
}

async function sendRequest(toId) {
  const res = await fetch("/api/user/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromId: currentUser.id, toId })
  });
  alert(await res.text());
}

async function loadRequests() {
  const res = await fetch(`/api/user/contacts/${currentUser.id}`);
  const data = await res.json();
  const list = document.getElementById("contacts-list");
  list.innerHTML = "";

  data.requests.forEach(req => {
    if (req.status === "pending") {
      const li = document.createElement("li");
      li.innerText = req.from.username;

      const acceptBtn = document.createElement("button");
      acceptBtn.innerText = "Accept";
      acceptBtn.onclick = async () => {
        await fetch("/api/user/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUser.id, requestId: req._id })
        });
        loadContacts();
      };

      li.appendChild(acceptBtn);
      list.appendChild(li);
    }
  });
}

// --- Admin ---

async function loadAdminUsers() {
  const res = await fetch("/api/admin/users");
  const users = await res.json();
  const view = document.getElementById("admin-view");
  view.innerHTML = "";

  users.forEach(user => {
    const div = document.createElement("div");
    div.className = "admin-user-card";
    div.innerHTML = `
      <div class="user-info">
        <strong>${user.username}</strong>
        <span>Logins: ${user.loginCount || 0}</span>
        <span>Last: ${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}</span>
        <span class="status ${user.isBanned ? "banned" : "active"}">${user.isBanned ? "Banned" : "Active"}</span>
      </div>
      <div class="user-actions">
        <button onclick="toggleBan('${user._id}')" class="action-btn ${user.isBanned ? "unban" : "ban"}">
          ${user.isBanned ? "Unban" : "Ban"}
        </button>
        <button onclick="deleteUser('${user._id}')" class="action-btn delete">Delete</button>
      </div>
    `;
    view.appendChild(div);
  });
}

async function toggleBan(id) {
  await fetch(`/api/admin/ban/${id}`, { method: "POST" });
  loadAdminUsers();
}

async function deleteUser(id) {
  if (confirm("Are you sure you want to delete this user permanently?")) {
    await fetch(`/api/admin/user/${id}`, { method: "DELETE" });
    loadAdminUsers();
  }
}

async function clearAllChats() {
  if (confirm("Are you sure? This will delete all messages.")) {
    await fetch("/api/admin/clear-chat", { method: "POST" });
    alert("All chats cleared.");
  }
}
