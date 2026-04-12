FROM node:20-alpine
WORKDIR /app

# Copy only backend files — no workspace complexity
COPY backend/package*.json ./
COPY backend/tsconfig.json ./
COPY backend/src ./src

# Install and build
RUN npm install
RUN npx tsc

EXPOSE 3001

CMD ["node", "dist/index.js"]
