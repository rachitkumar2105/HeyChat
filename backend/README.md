---
title: HeyChat API
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Realtime chat API with Express, Socket.IO and Supabase
---

# HeyChat API

Backend for [HeyChat](https://github.com/rachitkumar2105/HeyChat): authentication, one-to-one realtime
messaging, photo and voice-note processing. Runs as a Docker Space on Hugging Face.

- `GET /health`: liveness and database check
- `/api/*`: REST API (see the main repository README)
- `/socket.io`: realtime events
- `/media/*`: signed, expiring media links

Required Space secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Required Space variable: `CORS_ORIGINS` (the Vercel URL of the frontend).
