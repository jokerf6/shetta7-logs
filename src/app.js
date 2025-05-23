#!/usr/bin/env node

import config from "./config/index.js";
import { setEnvDataSync } from "./utils/env.util.js";
import { generateRandomString } from "./utils/random.util.js";
import path from "path";
import serve from "koa-static";
import render from "koa-ejs";
import koaBody from "koa-body";
import session from "koa-session";
import Koa from "koa";
import * as db from "./services/db.service.js";
import { fileURLToPath } from "url";

// Init Application

if (!config.APP_USERNAME || !config.APP_PASSWORD) {
  console.log(
    "You must first setup admin user. Run command -> npm run setup-admin-user"
  );
  process.exit(2);
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (!config.APP_SESSION_SECRET) {
  const randomString = generateRandomString();
  setEnvDataSync(config.APP_DIR, { APP_SESSION_SECRET: randomString });
  config.APP_SESSION_SECRET = randomString;
}

// Create App Instance
const app = new Koa();

// App Settings
app.proxy = true;
app.keys = [config.APP_SESSION_SECRET];

// Middlewares
app.use(session(app));

app.use(koaBody());

app.use(serve(path.join(__dirname, "public")));

await db.connect();

import router from "./routes/index.js";
app.use(router.routes());

render(app, {
  root: path.join(__dirname, "views"),
  layout: "base",
  viewExt: "html",
  cache: false,
  debug: false,
});

app.listen(config.PORT, config.HOST, () => {
  console.log(`Application started at http://${config.HOST}:${config.PORT}`);
});
