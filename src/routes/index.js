const config = require("../config");
const RateLimit = require("koa2-ratelimit").RateLimit;
const router = require("@koa/router")();
const {
  listApps,
  describeApp,
  reloadApp,
  restartApp,
  stopApp,
} = require("../providers/pm2/api");
const { validateUser, createUser } = require("../services/admin.service");
const { readLogsReverse } = require("../utils/read-logs.util");
const {
  getCurrentGitBranch,
  getCurrentGitCommit,
} = require("../utils/git.util");
const { getEnvFileContent } = require("../utils/env.util");
const { isAuthenticated, checkAuthentication } = require("../middlewares/auth");
const AnsiConverter = require("ansi-to-html");
const {
  listUsers,
  findByIdAndDelete,
  userPermissions,
} = require("../providers/users/get");
const { listViews } = require("../providers/views/get");
const ansiConvert = new AnsiConverter();

const loginRateLimiter = RateLimit.middleware({
  interval: 2 * 60 * 1000, // 2 minutes
  max: 100,
  prefixKey: "/login", // to allow the bdd to Differentiate the endpoint
});

router.post("/user/delete/:id", async (ctx) => {
  const userId = ctx.params.id;

  const users = await listUsers();
  const views = await listViews();
  const user = ctx.session.user;

  try {
    await findByIdAndDelete(userId);
    return ctx.redirect("/users", { users, views, error: null, user });
  } catch (err) {
    return await ctx.redirect("users", {
      users,
      views,
      user,
      error: err.message,
    });
  }
});
router.post("/user/create", async (ctx) => {
  const { name, password, permissions } = ctx.request.body;
  const arr = Array.isArray(permissions) ? permissions : [permissions];
  const per = JSON.stringify(arr.join(","));
  const users = await listUsers();
  const views = await listViews();
  const user = ctx.session.user;

  try {
    await createUser(name, password, per);
    return ctx.redirect("/users", { users, views, error: null, user });
  } catch (err) {
    return await ctx.redirect("/users", {
      users,
      views,
      user,
      error: err.message,
    });
  }
});

router.get("/", async (ctx) => {
  return ctx.redirect("/login");
});

router.get("/login", loginRateLimiter, checkAuthentication, async (ctx) => {
  return await ctx.render("auth/login", {
    layout: false,
    login: { username: "", password: "", error: null },
  });
});

router.post("/login", loginRateLimiter, checkAuthentication, async (ctx) => {
  const { username, password } = ctx.request.body;
  try {
    await validateUser(username, password);
    const user = await userPermissions(username);
    ctx.session.user = user[0];
    ctx.session.isAuthenticated = true;
    return ctx.redirect("/apps");
  } catch (err) {
    return await ctx.render("auth/login", {
      layout: false,
      login: { username, password, error: err.message },
    });
  }
});

router.get("/apps", isAuthenticated, async (ctx) => {
  const apps = await listApps();
  const user = ctx.session.user;
  const result = user.permissions.split(",").map((name, index) => ({
    id: index + 1,
    name: name.trim(),
  }));
  const views = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i].name[0] === '"') {
      views.push({
        id: result[i].id,
        name: result[i].name.slice(1),
      });
    }
    if (result[i].name[result[i].name.length - 1] === '"') {
      views.push({
        id: result[i].id,
        name: result[i].name.slice(0, result[i].name.length - 1),
      });
    }
    if (
      result[i].name[result[i].name.length - 1] !== '"' &&
      result[i].name[0] !== '"'
    )
      views.push(result[i]);
  }

  const { tab } = ctx.query;
  const activeTab = views.find((v) => v.name === tab)?.name || views[0].name;
  return await ctx.render(`apps/dashboard`, {
    apps,
    views,
    user,
    activeTab,
  });
});

router.get("/users", async (ctx) => {
  const users = await listUsers();
  const views = await listViews();
  const user = ctx.session.user;

  try {
    return ctx.render("/users/dashboard", { users, views, error: null, user });
  } catch (err) {
    return ctx.render("/users/dashboard", {
      users,
      views,
      error: err.message,
      user,
    });
  }
});
router.get("/logout", (ctx) => {
  ctx.session = null;
  return ctx.redirect("/login");
});

router.get("/apps/:appName", isAuthenticated, async (ctx) => {
  const { appName } = ctx.params;
  let app = await describeApp(appName);
  if (app) {
    app.git_branch = await getCurrentGitBranch(app.pm2_env_cwd);
    app.git_commit = await getCurrentGitCommit(app.pm2_env_cwd);
    app.env_file = await getEnvFileContent(app.pm2_env_cwd);
    const stdout = await readLogsReverse({ filePath: app.pm_out_log_path });
    const stderr = await readLogsReverse({ filePath: app.pm_err_log_path });
    const user = ctx.session.user;
    stdout.lines = stdout.lines
      .map((log) => {
        return ansiConvert.toHtml(log);
      })
      .join("<br/>");
    stderr.lines = stderr.lines
      .map((log) => {
        return ansiConvert.toHtml(log);
      })
      .join("<br/>");
    return await ctx.render("apps/app", {
      app,
      user,
      logs: {
        stdout,
        stderr,
      },
    });
  }
  return ctx.redirect("/apps");
});

router.get("/api/apps/:appName/logs/:logType", isAuthenticated, async (ctx) => {
  const { appName, logType } = ctx.params;
  const { linePerRequest, nextKey } = ctx.query;
  if (logType !== "stdout" && logType !== "stderr") {
    return (ctx.body = {
      error: "Log Type must be stdout or stderr",
    });
  }
  const app = await describeApp(appName);
  const filePath =
    logType === "stdout" ? app.pm_out_log_path : app.pm_err_log_path;
  let logs = await readLogsReverse({ filePath, nextKey });
  logs.lines = logs.lines
    .map((log) => {
      return ansiConvert.toHtml(log);
    })
    .join("<br/>");
  return (ctx.body = {
    logs,
  });
});

router.post("/api/apps/:appName/reload", isAuthenticated, async (ctx) => {
  try {
    let { appName } = ctx.params;
    let apps = await reloadApp(appName);
    if (Array.isArray(apps) && apps.length > 0) {
      return (ctx.body = {
        success: true,
      });
    }
    return (ctx.body = {
      success: false,
    });
  } catch (err) {
    return (ctx.body = {
      error: err,
    });
  }
});

router.post("/api/apps/:appName/restart", isAuthenticated, async (ctx) => {
  try {
    let { appName } = ctx.params;
    let apps = await restartApp(appName);
    if (Array.isArray(apps) && apps.length > 0) {
      return (ctx.body = {
        success: true,
      });
    }
    return (ctx.body = {
      success: false,
    });
  } catch (err) {
    console.log(err);
    return (ctx.body = {
      error: err,
    });
  }
});

router.post("/api/apps/:appName/stop", isAuthenticated, async (ctx) => {
  try {
    let { appName } = ctx.params;
    let apps = await stopApp(appName);
    if (Array.isArray(apps) && apps.length > 0) {
      return (ctx.body = {
        success: true,
      });
    }
    return (ctx.body = {
      success: false,
    });
  } catch (err) {
    return (ctx.body = {
      error: err,
    });
  }
});

module.exports = router;
