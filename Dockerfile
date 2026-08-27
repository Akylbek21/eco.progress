FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache chromium
ENV CHROME_PATH=/usr/bin/chromium
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY deploy/nginx-host/snippets/legacy-redirects.conf /etc/nginx/snippets/legacy-redirects.conf
COPY deploy/nginx-host/snippets/service-city-fallbacks.generated.conf /etc/nginx/snippets/service-city-fallbacks.generated.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
