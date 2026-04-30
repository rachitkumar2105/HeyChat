# 🚀 ChatWave — Complete Build & Deploy Guide
### Explained like you are 5 years old — every single step

---

## 📦 WHAT YOU ARE BUILDING

You are building a messaging app like WhatsApp that works in a browser.
It has real messages, photos, voice notes, groups, and more.
Everything is FREE.

---

## 🛠️ TOOLS YOU NEED (install these first)

### Step 1 — Install Node.js (the engine that runs JavaScript)

1. Open your browser and go to: **https://nodejs.org**
2. Click the big green button that says **"LTS"** (Long Term Support)
3. Download the file and double-click it
4. Click Next → Next → Next → Install → Finish
5. ✅ Done!

**How to check it worked:**
- Press `Windows Key + R`, type `cmd`, press Enter
- Type this and press Enter:
  ```
  node --version
  ```
- You should see something like `v20.11.0` — that means it worked!

---

### Step 2 — Install VS Code (your code editor)

1. Go to: **https://code.visualstudio.com**
2. Click **Download for Windows** (or Mac/Linux)
3. Install it like a normal program
4. Open VS Code after installing

**Useful VS Code extensions to install:**
- Open VS Code → Click the 4 squares icon on the left sidebar
- Search and install:
  - `ES7+ React/Redux/React-Native snippets` (by dsznajder)
  - `Prettier - Code formatter` (by Prettier)
  - `Auto Rename Tag` (by Jun Han)

---

## 🔗 STEP 3 — Set Up Supabase (Your FREE Backend)

Supabase is like a smart box that stores ALL your app's data.
Think of it as a filing cabinet + security guard + live messenger.

### 3a. Create Supabase Account
1. Go to: **https://supabase.com**
2. Click **"Start your project"**
3. Sign up with GitHub or Email
4. Click **"New Project"**
5. Fill in:
   - **Project Name:** `chatwave`
   - **Database Password:** Make a strong password (SAVE THIS SOMEWHERE!)
   - **Region:** Choose the one closest to you
6. Click **"Create new project"**
7. Wait 1-2 minutes for it to set up (you'll see a loading screen)

### 3b. Get Your Keys
These are like secret passwords your app uses to talk to Supabase.

1. In Supabase, click **"Settings"** (gear icon, left sidebar)
2. Click **"API"**
3. You will see:
   - **Project URL** → Copy this (looks like `https://abcxyz.supabase.co`)
   - **anon public key** → Copy this (a very long text string)
4. Save both somewhere (Notepad is fine for now)

### 3c. Run the Database Schema
This creates all your tables (like spreadsheets) in the database.

1. In Supabase, click **"SQL Editor"** (left sidebar, looks like `</>`)
2. Click **"New Query"**
3. Open the file `supabase-schema.sql` from your project folder
4. Select ALL the text (Ctrl+A) and Copy it (Ctrl+C)
5. Paste it into the Supabase SQL Editor
6. Click the green **"Run"** button (or press Ctrl+Enter)
7. You should see "Success. No rows returned" at the bottom ✅

### 3d. Enable Email Verification
1. In Supabase, click **"Authentication"** (left sidebar)
2. Click **"Providers"**
3. Make sure **Email** is enabled (toggle is ON)
4. Click **"Email Templates"** → You can customize the verification email here

### 3e. Set Up Storage Buckets
The SQL already creates your storage buckets. To verify:
1. Click **"Storage"** in left sidebar
2. You should see 4 buckets: `avatars`, `images`, `files`, `voice-notes`
3. If not, click **"New Bucket"** and create each one (set Public = ON)

---

## 🤗 STEP 4 — Get Hugging Face Token (FREE AI)

Hugging Face gives you AI features like voice-to-text.

1. Go to: **https://huggingface.co**
2. Click **"Sign Up"** (top right) — it's free
3. Verify your email
4. Click your profile picture → **"Settings"**
5. Click **"Access Tokens"** in the left menu
6. Click **"New Token"**
7. Name it `chatwave`, Role = **Read**, click **"Generate"**
8. Copy the token (starts with `hf_...`) — SAVE THIS!

---

## 💻 STEP 5 — Download & Set Up the Project in VS Code

### 5a. Open the Project Folder

1. Create a folder on your computer called `chatwave`
   (e.g., `C:\Users\YourName\Desktop\chatwave`)
2. Copy all the project files into this folder
3. Open VS Code
4. Click **File → Open Folder**
5. Select your `chatwave` folder
6. Click **"Select Folder"**

You should now see all the files in VS Code's left panel!

### 5b. Create Your .env.local File (Secret Keys)

⚠️ This file holds your secret keys. NEVER share it or upload it to GitHub!

1. In VS Code, look at the left panel (Explorer)
2. Right-click on the `chatwave` folder → **"New File"**
3. Name it exactly: `.env.local`
4. Double-click it to open it
5. Type this (replacing with YOUR actual values from Step 3b and Step 4):

```
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_very_long_anon_key_here
REACT_APP_HF_TOKEN=hf_your_huggingface_token_here
```

6. Press Ctrl+S to save

### 5c. Open the Terminal in VS Code

The terminal is like a command window inside VS Code.

1. Click **Terminal → New Terminal** (top menu bar)
2. A black panel opens at the bottom — this is the terminal!
3. Make sure it shows your project path (e.g., `C:\Users\...\chatwave`)

### 5d. Install All Packages

Packages are like LEGO pieces other developers made that we use in our app.

In the terminal, type this and press Enter:
```bash
npm install
```

⏳ Wait 2-5 minutes. You'll see lots of text scrolling.
When it stops and shows your folder path again, it's done!

If you see errors, try:
```bash
npm install --legacy-peer-deps
```

---

## ▶️ STEP 6 — Run the App Locally (Test on Your Computer)

In the VS Code terminal, type:
```bash
npm start
```

⏳ Wait 30-60 seconds.

Your browser should automatically open at **http://localhost:3000**

You'll see the ChatWave login page! 🎉

**To stop the app:** Press `Ctrl + C` in the terminal

---

## 🧪 STEP 7 — Test Everything Works

### Test 1: Sign Up
1. Click "Sign Up" tab
2. Fill in your details
3. Click "Create Account"
4. Check your email for a verification link
5. Click the link in the email
6. Go back to the app and Login

### Test 2: Send a Message
1. Click the ✉️ button in the sidebar
2. Search for another user (you need 2 accounts to test)
3. Click their name
4. Type a message and press Enter
5. It should appear instantly!

### Test 3: Upload an Image
1. Open a chat
2. Click the 📎 button
3. Select an image
4. It should upload and appear in the chat

### Test 4: Voice Note
1. Open a chat
2. HOLD the 🎤 button
3. Speak something
4. RELEASE the button
5. The voice note sends (and the AI tries to transcribe it!)

---

## 🌐 STEP 8 — Deploy to the Internet (Go LIVE!)

### Option A: Deploy on Vercel (EASIEST — Recommended)

Vercel is like a hosting service that makes your app live on the internet for FREE.

**8a. Push Code to GitHub first:**

1. Go to **https://github.com** and create a free account
2. Click the **"+"** button → **"New Repository"**
3. Name it `chatwave`, click **"Create Repository"**
4. In VS Code terminal, type these one by one:

```bash
git init
git add .
git commit -m "Initial commit - ChatWave app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/chatwave.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

⚠️ Make sure `.env.local` is in your `.gitignore` file so secrets don't get uploaded!

Create a file called `.gitignore` in your project root and add:
```
node_modules/
.env.local
build/
```

**8b. Deploy on Vercel:**

1. Go to **https://vercel.com**
2. Click **"Sign Up"** → Sign up with GitHub (easiest)
3. Click **"New Project"**
4. Find your `chatwave` repository and click **"Import"**
5. Under **"Environment Variables"**, add these 3 variables:

   | Key | Value |
   |-----|-------|
   | `REACT_APP_SUPABASE_URL` | (your Supabase URL) |
   | `REACT_APP_SUPABASE_ANON_KEY` | (your Supabase anon key) |
   | `REACT_APP_HF_TOKEN` | (your Hugging Face token) |

6. Click **"Deploy"**
7. Wait 2-3 minutes ⏳
8. Vercel gives you a URL like: `https://chatwave-abc123.vercel.app`
9. 🎉 YOUR APP IS LIVE ON THE INTERNET!

**8c. Add your Vercel URL to Supabase (important!):**

1. Go back to Supabase → **Authentication → URL Configuration**
2. Add your Vercel URL to **"Redirect URLs"**:
   ```
   https://chatwave-abc123.vercel.app/**
   ```
3. Also update **"Site URL"** to your Vercel URL
4. Click Save

---

### Option B: Deploy on Netlify (Alternative)

1. Run `npm run build` in terminal to create production files
2. Go to **https://netlify.com** → Sign up free
3. Drag and drop the `build` folder onto Netlify's dashboard
4. Add your environment variables in **Site Settings → Environment**
5. Done! You get a `.netlify.app` URL

---

### Option C: Deploy on Railway (Alternative)

1. Go to **https://railway.app** → Sign up free
2. Click **"New Project"** → **"Deploy from GitHub"**
3. Connect your repository
4. Add environment variables
5. Railway auto-detects React and deploys it

---

## 🔄 STEP 9 — How to Update Your App After Deployment

Every time you change code and want it live:

```bash
git add .
git commit -m "Updated something"
git push
```

Vercel automatically detects the push and redeploys! ✅

---

## 🐛 STEP 10 — Common Problems & Solutions

### Problem: "npm install" fails
```bash
npm install --legacy-peer-deps --force
```

### Problem: App shows blank white screen
- Open browser → Right-click → Inspect → Console tab
- Look for red error messages
- Most common cause: wrong .env.local values

### Problem: Can't send messages
- Check Supabase → Authentication → User is verified
- Check that you ran the SQL schema correctly

### Problem: Images don't upload
- Check Supabase → Storage → Buckets are created and PUBLIC

### Problem: Real-time doesn't work
- Check Supabase → Database → Replication → Realtime is ON for messages table

### Problem: Voice transcription fails
- That's OK! The voice note still saves — transcription is a bonus AI feature
- Check your Hugging Face token in .env.local

---

## 📱 STEP 11 — Make it Work on Mobile

The app already has basic mobile support! To test:
1. Find your computer's IP address (type `ipconfig` in terminal → look for IPv4)
2. On your phone (same WiFi), open browser and go to:
   `http://YOUR_IP_ADDRESS:3000`
   Example: `http://192.168.1.5:3000`

---

## 🎯 FEATURES CHECKLIST

After following all steps, test each feature:

- [ ] Sign up with email
- [ ] Email verification works
- [ ] Login / Logout
- [ ] See sidebar with chats
- [ ] Search for users
- [ ] Start a new 1-on-1 chat
- [ ] Send text messages (real-time!)
- [ ] ✓ single tick (sent)
- [ ] ✓✓ double tick (delivered)
- [ ] ✓✓ blue tick (seen)
- [ ] Send images
- [ ] Send files
- [ ] Record and send voice note
- [ ] Voice-to-text transcription
- [ ] Add emoji reactions to messages
- [ ] Open emoji picker
- [ ] Create a group chat
- [ ] Delete message for me
- [ ] Delete message for everyone
- [ ] Clear chat
- [ ] Edit profile (name, bio, photo)
- [ ] Toggle last seen on/off
- [ ] Block a user
- [ ] Report a user
- [ ] Mobile responsive layout

---

## 💰 FREE TIER LIMITS (Don't Worry About These Yet)

| Service | Free Limit |
|---------|-----------|
| Supabase DB | 500 MB |
| Supabase Storage | 1 GB |
| Supabase Bandwidth | 2 GB/month |
| Supabase Realtime | 200 concurrent users |
| Vercel Hosting | Unlimited deploys |
| Vercel Bandwidth | 100 GB/month |
| Hugging Face API | ~30,000 requests/month |

These limits are MORE than enough for a personal project or small app!

---

## 🎓 WHAT YOU JUST LEARNED

By building this app, you now understand:

1. **React** — How to build user interfaces with components
2. **Supabase** — How to store data, authenticate users, and use real-time features
3. **SQL** — How to design database tables and set up security rules
4. **File Storage** — How to upload and serve images/files/audio
5. **AI Integration** — How to use AI APIs (Hugging Face)
6. **Git & GitHub** — How to save and share code
7. **Deployment** — How to put an app live on the internet

---

## 🆘 NEED HELP?

If something doesn't work:
1. Read the error message carefully — it usually tells you what's wrong
2. Google the error message (every developer does this!)
3. Check Supabase logs: Supabase → Logs → API logs
4. Check browser console: F12 → Console tab

You built a real production-grade chat application. That's AMAZING! 🎉
