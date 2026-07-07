import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

const REDIS_PLACEHOLDER = 'YOUR_UPSTASH_PASSWORD';
const EVENTS_CHANNEL = 'app:events';

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('error', (err) => {
      logger.warn('WebSocket error', { error: err.message });
    });
  });

  // Subscribe to Redis events and forward to WebSocket clients
  if (!config.redis.url.includes(REDIS_PLACEHOLDER)) {
    const sub = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });
    sub.subscribe(EVENTS_CHANNEL, (err) => {
      if (err) {
        logger.warn('Failed to subscribe to events channel', { error: err.message });
      } else {
        logger.info('Subscribed to redis events channel');
      }
    });
    sub.on('message', (_channel, message) => {
      try {
        const parsed = JSON.parse(message);
        broadcastRaw(message);
      } catch {
        // ignore malformed messages
      }
    });
    sub.on('error', (err) => {
      logger.warn('Events subscriber error', { error: err.message });
    });
  }

  logger.info('WebSocket server initialized');
  return wss;
}

function broadcastRaw(message: string): void {
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function broadcast(event: string, payload: Record<string, unknown>): void {
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  broadcastRaw(message);
}
