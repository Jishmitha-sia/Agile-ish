/**
 * OTel bootstrap module — must be the FIRST require in the application.
 *
 * `main.ts` imports this as a side-effect import on line 1 so that the
 * OpenTelemetry SDK's `require` hooks are in place before NestJS,
 * Prisma, ioredis, BullMQ, etc. are loaded. Modules loaded before the SDK
 * starts are invisible to auto-instrumentation for the lifetime of the
 * process.
 *
 * This is intentionally a tiny module — no Nest, no decorators, no Prisma —
 * so the OTel boot path stays fast and side-effect-free.
 */
import { startTelemetry } from './infra/telemetry/telemetry.js';

startTelemetry();
