# Use Node.js as the base image
FROM node:18

# Create app directory
WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install dependencies
RUN npm install --production

# Copy the server source code and critical directories
COPY server/index.js ./
COPY server/socket.js ./
COPY server/routes/ ./routes/
COPY server/controllers/ ./controllers/
COPY server/models/ ./models/
COPY server/middleware/ ./middleware/

# Create uploads directory
RUN mkdir -p uploads

# Expose the port (Hugging Face default is 7860)
EXPOSE 7860

# Set environment variables
ENV NODE_ENV=production
ENV PORT=7860

# Start the application
CMD ["node", "index.js"]
