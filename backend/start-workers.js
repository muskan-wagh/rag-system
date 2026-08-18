const path = require('path');
const { fork } = require('child_process');

const RESUME_WORKER = path.join(__dirname, 'start-worker.js');
const EMAIL_WORKER = path.join(__dirname, 'start-email-worker.js');

const MAX_RESTARTS = 5;
const RESTART_DELAY_MS = 3000;

let isShuttingDown = false;

function startProcess(name, script) {
  let restartCount = 0;

  function spawn() {
    const child = fork(script, [], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env },
    });

    child.stdout.on('data', (data) => {
      for (const line of data.toString().trim().split('\n')) {
        console.log(`[${name}] ${line}`);
      }
    });

    child.stderr.on('data', (data) => {
      for (const line of data.toString().trim().split('\n')) {
        console.error(`[${name}] ${line}`);
      }
    });

    child.on('exit', (code, signal) => {
      if (isShuttingDown) return;

      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      const isCrash = code !== 0 || signal;
      console.error(`[${name}] exited with ${reason}`);

      if (isCrash) {
        restartCount++;
        if (restartCount < MAX_RESTARTS) {
          console.log(`[${name}] restarting (attempt ${restartCount}/${MAX_RESTARTS}) in ${RESTART_DELAY_MS}ms...`);
          setTimeout(spawn, RESTART_DELAY_MS);
        } else {
          console.error(`[${name}] exhausted ${MAX_RESTARTS} restarts. Not restarting.`);
        }
      }
    });

    child.on('error', (err) => {
      console.error(`[${name}] process error: ${err.message}`);
    });
  }

  spawn();
}

process.on('SIGINT', () => {
  isShuttingDown = true;
  process.exit(0);
});
process.on('SIGTERM', () => {
  isShuttingDown = true;
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  console.error(`[start-workers] Uncaught exception: ${err.message}`);
  process.exit(1);
});

console.log('[start-workers] Starting resume + email workers...');
startProcess('RESUME', RESUME_WORKER);
startProcess('EMAIL', EMAIL_WORKER);