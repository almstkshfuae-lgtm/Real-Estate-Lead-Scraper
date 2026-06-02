FROM mcr.microsoft.com/playwright:v1.49.1-noble

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including Prisma
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npm run build

# Expose the scraper service port
EXPOSE 3002

# Start the application
CMD ["npm", "start"]
