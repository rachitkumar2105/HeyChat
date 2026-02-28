# Use Node.js as the base image
FROM node:18

# Create app directory
WORKDIR /app

# Copy server package files and install
COPY server/package*.json ./
RUN npm install --production

# Copy the server source code correctly
# Using '.' because we are in /app and we want to preserve structure
COPY server/ .

# Create uploads directory
RUN mkdir -p uploads

# High-resolution logging for production
ENV DEBUG=express:*,socket.io:*
ENV NODE_ENV=production
ENV PORT=7860

# Hugging Face default port is 7860
EXPOSE 7860

# Start the application
CMD ["node", "index.js"]
