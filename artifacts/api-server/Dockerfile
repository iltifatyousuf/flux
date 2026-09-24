FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy root workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy necessary packages
COPY lib/api-zod ./lib/api-zod
COPY lib/db ./lib/db
COPY artifacts/api-server ./artifacts/api-server

# Install dependencies (only for api-server to save memory/time)
RUN pnpm install --filter @workspace/api-server...

# Build the db schema/drizzle client and api-server
RUN pnpm --filter @workspace/db run build || true
RUN pnpm --filter @workspace/api-server run build

# Set the working directory to the API server for running
WORKDIR /app/artifacts/api-server

# Expose the API port
EXPOSE 8080
ENV PORT=8080

# Start the application
CMD ["node", "dist/index.mjs"]
