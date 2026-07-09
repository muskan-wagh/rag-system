const path = require('path');
const { fork } = require('child_process');

const SERVER_SCRIPT = path.join(__dirname, 'start.js');
const WORKER_SCRIPT = path.join(__dirname, 'start-worker.js');

const MAX_WORKER_RESTARTS = 5;
const WORKER_RESTART_DELAY_MS = 2000;

let workerRestartCount = 0;
let serverProcess = null;
let workerProcess = null;
let isShuttingDown = false;

function startServer() {
  serverProcess = fork(SERVER_SCRIPT, [], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env },
  });

  serverProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.log(`[SERVER] ${line}`);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.error(`[SERVER] ${line}`);
    }
  });

  serverProcess.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    console.error(`[start-all] Server exited with ${reason}`);

    if (!isShuttingDown) {
      cleanup();
      process.exit(code || 1);
    }
  });

  serverProcess.on('error', (err) => {
    console.error(`[start-all] Server process error: ${err.message}`);
    if (!isShuttingDown) {
      cleanup();
      process.exit(1);
    }
  });
}

function startWorker() {
  if (isShuttingDown) return;

  workerProcess = fork(WORKER_SCRIPT, [], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env },
  });

  workerProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.log(`[WORKER] ${line}`);
    }
  });

  workerProcess.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.error(`[WORKER] ${line}`);
    }
  });

  workerProcess.on('exit', (code, signal) => {
    if (isShuttingDown) return;

    const isCrash = code !== 0 || signal;
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    console.error(`[start-all] Worker exited with ${reason}`);

    if (isCrash && workerRestartCount < MAX_WORKER_RESTARTS) {
      workerRestartCount++;
      console.log(`[start-all] Restarting worker (attempt ${workerRestartCount}/${MAX_WORKER_RESTARTS}) in ${WORKER_RESTART_DELAY_MS}ms...`);
      setTimeout(() => startWorker(), WORKER_RESTART_DELAY_MS);
    } else if (isCrash) {
      console.error(`[start-all] Worker exhausted ${MAX_WORKER_RESTARTS} restarts. Not restarting.`);
    }
  });

  workerProcess.on('error', (err) => {
    console.error(`[start-all] Worker process error: ${err.message}`);
  });
}

function cleanup() {
  isShuttingDown = true;

  if (workerProcess) {
    try { workerProcess.kill('SIGTERM'); } catch {}
    workerProcess = null;
  }

  if (serverProcess) {
    try { serverProcess.kill('SIGTERM'); } catch {}
    serverProcess = null;
  }
}

process.on('SIGINT', () => {
  console.log('[start-all] Received SIGINT, shutting down...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[start-all] Received SIGTERM, shutting down...');
  cleanup();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error(`[start-all] Uncaught exception: ${err.message}`);
  cleanup();
  process.exit(1);
});

console.log('[start-all] Starting server and worker...');
startServer();
startWorker();