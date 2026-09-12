module.exports = {
  apps: [
    {
      name: "timetracker",
      script: "dist/server.cjs",
      cwd: "/home/ubuntu/projects/TimeTracker",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "0.0.0.0",
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      log_file: "/home/ubuntu/.pm2/logs/timetracker-combined.log",
      out_file: "/home/ubuntu/.pm2/logs/timetracker-out.log",
      error_file: "/home/ubuntu/.pm2/logs/timetracker-error.log",
    },
  ],
};
