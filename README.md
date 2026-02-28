---
title: HeyChat Backend
emoji: 💬
colorFrom: green
colorTo: blue
sdk: docker
pinned: false
---

# HeyChat Backend

This is the backend server for **HeyChat**, a real-time chat application built with Node.js, Express, Socket.IO, and MongoDB.

## Tech Stack
- **Node.js** + **Express**
- **Socket.IO** for real-time communication
- **MongoDB** + **Mongoose**
- **JWT** for authentication
- **Docker** for deployment

## Environment Variables (Secrets)
Set these in your Hugging Face Space **Settings > Variables and secrets**:

| Secret Name | Description |
|-------------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `CLIENT_URL` | Your Vercel frontend URL (for CORS) |
