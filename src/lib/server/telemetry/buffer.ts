import { prisma } from '../prisma';

export interface TelemetryRecord {
  method: string;
  path: string;
  statusCode: number;
  elapsedMs: number;
  ipAddress: string;
  userId: string | null;
}

const ringBuffer: TelemetryRecord[] = [];
const BATCH_SIZE = 100;
let lastPrune = Date.now();

export function recordTelemetry(record: TelemetryRecord) {
  ringBuffer.push(record);
  if (ringBuffer.length >= BATCH_SIZE) {
    void flushTelemetry();
  }
}

export async function flushTelemetry() {
  if (ringBuffer.length === 0) return;
  const batch = ringBuffer.splice(0, ringBuffer.length);
  try {
    await prisma.httpTrafficLog.createMany({
      data: batch.map((item) => ({
        method: item.method.slice(0, 10),
        path: item.path.slice(0, 255),
        statusCode: item.statusCode,
        elapsedMs: item.elapsedMs,
        ipAddress: item.ipAddress.slice(0, 45),
        userId: item.userId,
      })),
    });
  } catch (err) {
    console.error('Failed to flush telemetry batch:', err);
  }

  // Periodic pruning of records older than 14 days
  const now = Date.now();
  if (now - lastPrune > 24 * 60 * 60 * 1000) {
    lastPrune = now;
    const cutoff = new Date(now - 14 * 24 * 60 * 60 * 1000);
    try {
      await prisma.httpTrafficLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
    } catch (err) {
      console.error('Failed to prune telemetry logs:', err);
    }
  }
}

// Timer to flush every 10 seconds
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    void flushTelemetry();
  }, 10_000);
  if (timer.unref) timer.unref();
}

