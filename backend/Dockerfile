FROM node:18-bullseye

# Install Python and FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install Python dependencies
RUN pip3 install numpy scipy scikit-learn joblib

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Expose port
EXPOSE 5000

# Start command
CMD [ "node", "server.js" ]
