FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @lanboard/client build
EXPOSE 3000
CMD ["pnpm", "--filter", "@lanboard/server", "start"]
