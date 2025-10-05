module.exports = {
  "apps": [
    {
      "name": "shinepod-backend",
      "script": "./server-with-file-db.js",
      "instances": "max",
      "exec_mode": "cluster",
      "env": {
        "NODE_ENV": "production",
        "PORT": 3000,
        "HOST": "0.0.0.0"
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": 3000,
        "HOST": "0.0.0.0"
      },
      "log_file": "./logs/backend.log",
      "out_file": "./logs/backend-out.log",
      "error_file": "./logs/backend-error.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "merge_logs": true,
      "max_memory_restart": "1G",
      "node_args": "--max-old-space-size=1024",
      "restart_delay": 4000,
      "max_restarts": 10,
      "min_uptime": "10s",
      "watch": false,
      "ignore_watch": [
        "node_modules",
        "logs",
        "data"
      ],
      "watch_options": {
        "followSymlinks": false
      }
    },
    {
      "name": "shinepod-mobile-app",
      "script": "./mobile-app-server.js",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "production",
        "PORT": 3002,
        "HOST": "0.0.0.0"
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": 3002,
        "HOST": "0.0.0.0"
      },
      "log_file": "./logs/mobile-app.log",
      "out_file": "./logs/mobile-app-out.log",
      "error_file": "./logs/mobile-app-error.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "merge_logs": true,
      "max_memory_restart": "512M",
      "restart_delay": 4000,
      "max_restarts": 10,
      "min_uptime": "10s",
      "watch": false
    }
  ]
};