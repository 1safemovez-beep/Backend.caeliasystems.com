FROM node:24-alpine

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Install Node dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY . ./
COPY .env.example ./

# Create required directories
RUN mkdir -p data storage

ENV PORT=8787
EXPOSE 8787

# Alicia supplies .env at deploy time (mounted secret, never baked in).
CMD ["node", "index.js"]
