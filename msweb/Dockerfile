FROM node:20-alpine

WORKDIR /app

ADD package.json .
ADD package-lock.json .
ADD tsconfig.json .

RUN npm i

ADD public ./public
ADD src ./src

RUN npm run build

FROM nginx

COPY --from=0 /app/build /usr/share/nginx/html