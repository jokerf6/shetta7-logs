const { listApps } = require("../providers/pm2/api");
const { listViews } = require("../providers/views/get");

const checkAuthentication = async (ctx, next) => {
  const views = await listViews();
  const apps = await listApps();

  const user = ctx.session.user;

  if (ctx.session.isAuthenticated) {
    return ctx.redirect("/apps", { views, user, apps });
  }
  await next();
};

const isAuthenticated = async (ctx, next) => {
  if (!ctx.session.isAuthenticated) {
    return ctx.redirect("/login");
  }
  await next();
};

module.exports = {
  isAuthenticated,
  checkAuthentication,
};
