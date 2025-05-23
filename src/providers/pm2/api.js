const pm2 = require("pm2");
const { bytesToSize, timeSince } = require("./ux.helper");

function listApps() {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error("PM2 connection error:", err);
        return reject(err);
      }
      pm2.list((err, apps) => {
        pm2.disconnect();
        if (err) {
          console.error("PM2 list error:", err);
          return reject(err);
        }

        apps = apps
          .filter((app) => app.name !== "pm2")
          .map((app) => {
            // Helper function to format bytes to a readable size
            function bytesToSize(bytes) {
              const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
              if (bytes === 0) return "0 Byte";
              const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
              return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
            }

            // Helper function to calculate time since
            function timeSince(dateInMs) {
              if (!dateInMs) return "N/A";
              const seconds = Math.floor((new Date() - dateInMs) / 1000);

              let interval = seconds / 31536000;
              if (interval > 1) {
                return Math.floor(interval) + " years";
              }
              interval = seconds / 2592000;
              if (interval > 1) {
                return Math.floor(interval) + " mo";
              }
              interval = seconds / 86400;
              if (interval > 1) {
                return Math.floor(interval) + " days";
              }
              interval = seconds / 3600;
              if (interval > 1) {
                return Math.floor(interval) + " hr";
              }
              interval = seconds / 60;
              if (interval > 1) {
                return Math.floor(interval) + " min";
              }
              return Math.floor(seconds) + " sec";
            }

            const appStatus = app.pm2_env.status;
            const isOnline = appStatus === "online";

            let lastSuccessTime = "N/A";
            let lastSuccessRun = "";
            let lastFailureTime = "N/A";
            let lastFailureRun = "";
            let lastDuration = "N/A";

            if (isOnline) {
              lastSuccessTime = timeSince(app.pm2_env.pm_uptime);
              // Using restarts as a "run number". PM2 restarts is the count of how many times it has restarted.
              lastSuccessRun = `#${
                app.pm2_env.restarts !== undefined
                  ? app.pm2_env.restarts
                  : "N/A"
              }`;
              // For online apps, current uptime is the last duration
              lastDuration = timeSince(app.pm2_env.pm_uptime);
            } else {
              // If the app is not online, it might have failed or stopped.
              // We use the last start time or modified time to estimate "last failure time"
              // This is an approximation as PM2 doesn't store explicit "last failure" timestamps easily accessible here.
              lastFailureTime = timeSince(
                app.pm2_env.unstable_restarts
                  ? app.pm2_env.pm_uptime
                  : app.pm2_env.pm_modified_at || Date.now()
              ); // Using pm_uptime if unstable restarts, otherwise modified_at
              lastFailureRun = `#${
                app.pm2_env.restarts !== undefined
                  ? app.pm2_env.restarts
                  : "N/A"
              }`; // Still using restarts as a "run number"
              // If app is not online, duration of last run is difficult without log parsing.
              // We could say it's 0 or N/A or some inferred value from its state.
              // For simplicity, we'll leave it as N/A if not online and not actively measuring.
            }
            let view = "";
            if (app.name.includes("api")) view = "api";
            else if (app.name.includes("mobile")) view = "flutter";
            else view = "frontend";

            return {
              status: isOnline ? "success" : "failure", // Used for the checkmark/x icon
              weather: isOnline ? "sun" : "rain", // Used for the sun/rain icon
              name: app.name,
              view,
              lastSuccessTime: lastSuccessTime,
              lastSuccessRun: lastSuccessRun,
              lastFailureTime: lastFailureTime,
              lastFailureRun: lastFailureRun,
              lastDuration: lastDuration, // This will be the uptime if online, otherwise N/A for simplicity
              cpu: app.monit.cpu,
              memory: bytesToSize(app.monit.memory),
              uptime: timeSince(app.pm2_env.pm_uptime), // This is the actual current uptime
              pm_id: app.pm_id,
            };
          });
        resolve(apps);
      });
    });
  });
}
function describeApp(appName) {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
      }
      pm2.describe(appName, (err, apps) => {
        pm2.disconnect();
        if (err) {
          reject(err);
        }
        if (Array.isArray(apps) && apps.length > 0) {
          const app = {
            name: apps[0].name,
            status: apps[0].pm2_env.status,
            cpu: apps[0].monit.cpu,
            memory: bytesToSize(apps[0].monit.memory),
            uptime: timeSince(apps[0].pm2_env.pm_uptime),
            pm_id: apps[0].pm_id,
            pm_out_log_path: apps[0].pm2_env.pm_out_log_path,
            pm_err_log_path: apps[0].pm2_env.pm_err_log_path,
            pm2_env_cwd: apps[0].pm2_env.pm_cwd,
          };
          resolve(app);
        } else {
          resolve(null);
        }
      });
    });
  });
}

function reloadApp(process) {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
      }
      pm2.reload(process, (err, proc) => {
        pm2.disconnect();
        if (err) {
          reject(err);
        }
        resolve(proc);
      });
    });
  });
}

function stopApp(process) {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
      }
      pm2.stop(process, (err, proc) => {
        pm2.disconnect();
        if (err) {
          reject(err);
        }
        resolve(proc);
      });
    });
  });
}

function restartApp(process) {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
      }
      pm2.restart(process, (err, proc) => {
        pm2.disconnect();
        if (err) {
          reject(err);
        }
        resolve(proc);
      });
    });
  });
}

module.exports = {
  listApps,
  describeApp,
  reloadApp,
  stopApp,
  restartApp,
};
