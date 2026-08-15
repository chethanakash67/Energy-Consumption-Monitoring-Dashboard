import { Response } from 'express';

/**
 * Server-Sent Events hub.
 *
 * SSE is used instead of WebSockets because the live feed is strictly
 * server -> client: no client messages, so the extra protocol surface of a
 * socket buys nothing, and SSE reconnects automatically in the browser.
 */

export type RealtimeEvent =
  | { type: 'live'; payload: LivePayload }
  | { type: 'alert'; payload: unknown }
  | { type: 'reading'; payload: { timestamp: string } };

export interface LiveDeviceSample {
  deviceId: string;
  name: string;
  kw: number;
}

export interface LivePayload {
  timestamp: string;
  /** Net instantaneous demand across all devices, in kW. */
  totalKw: number;
  /** Gross draw, excluding solar generation. */
  demandKw: number;
  /** Solar output as a positive number. */
  generationKw: number;
  /** Spend rate at this instant, in currency units per hour. */
  costPerHour: number;
  devices: LiveDeviceSample[];
}

interface Client {
  id: number;
  res: Response;
}

const clients = new Set<Client>();
let nextClientId = 1;

/** Registers an SSE response stream and wires up teardown. */
export function addClient(res: Response): () => void {
  const client: Client = { id: nextClientId++, res };
  clients.add(client);

  res.write(`retry: 3000\n\n`);
  send(client, { type: 'connected', clients: clients.size });

  return () => {
    clients.delete(client);
  };
}

function send(client: Client, data: unknown, eventName = 'message') {
  try {
    client.res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // The socket died between the readyState check and the write; drop it.
    clients.delete(client);
  }
}

export function broadcast(event: RealtimeEvent) {
  for (const client of clients) {
    send(client, event.payload, event.type);
  }
}

/** Comment frame that keeps proxies from closing an idle connection. */
export function heartbeat() {
  for (const client of clients) {
    try {
      client.res.write(': ping\n\n');
    } catch {
      clients.delete(client);
    }
  }
}

export function clientCount(): number {
  return clients.size;
}
