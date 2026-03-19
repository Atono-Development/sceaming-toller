# Stage 1: Build the static assets
FROM node:20-alpine AS builder

WORKDIR /app

# Add build arguments for Vite
# ARG VITE_API_URL
ARG VITE_TURNSTILE_SITE_KEY

# Set them as environment variables for the build process
# ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
