# Use Node.js as the base image
FROM node:18-slim

# Create app directory
WORKDIR /app

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=7860
ENV DEBUG=express:*,socket.io:*

# Copy server package files and install
COPY server/package*.json ./
RUN npm install --production

# Copy the server source code correctly
COPY server/ .

# Create uploads directory with correct permissions
RUN mkdir -p uploads && chmod 777 uploads

# Hugging Face default port is 7860
EXPOSE 7860

# Start the application using node directly for speed
CMD ["node", "index.js"]
