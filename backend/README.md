# HeyChat API

Backend for [HeyChat](https://github.com/rachitkumar2105/HeyChat): authentication, one-to-one realtime
messaging, photo and voice-note processing. Ships as a Docker image (deployed on Render).

- `GET /health`: liveness and database check
- `/api/*`: REST API (see the main repository README)
- `/socket.io`: realtime events
- `/media/*`: signed, expiring media links

Required environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret), `CORS_ORIGINS` (the frontend URL).
