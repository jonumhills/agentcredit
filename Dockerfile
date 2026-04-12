FROM node:20-alpine
WORKDIR /app

# Copy root workspace manifest
COPY package*.json ./

# Copy backend source
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

# Install only backend dependencies (skip contracts/agents/frontend)
RUN npm install --workspace=backend

# Compile TypeScript
RUN npm run build --workspace=backend

EXPOSE 3001

CMD ["node", "backend/dist/index.js"]
