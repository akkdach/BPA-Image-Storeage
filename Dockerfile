# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose port
EXPOSE 3000

# Set environment variable for NAS_DIR (can be overridden)
ENV NAS_DIR=/nas/images

# Create NAS_DIR if not exists
RUN mkdir -p /nas/images

# Start the server
CMD ["node", "index.js"]
