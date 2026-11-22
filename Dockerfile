FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time settings (rewrites and NEXT_PUBLIC_* are inlined by `next build`); passed as Docker build args by the host. An ARG with no value stays unset.
ARG API_PROXY_ORIGIN
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
