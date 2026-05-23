/**
 * OpenTelemetry bootstrap.
 *
 * This file is imported by `main.ts` as the *very first* statement, before
 * `@nestjs/core` is loaded. OTel auto-instrumentation patches modules at
 * require-time — anything that loads before the SDK starts is invisible
 * to tracing.
 *
 * Disabled by default in dev (`OTEL_ENABLED=false`). The SDK construction
 * itself is cheap; we still guard it so we don't pay attaching exporters
 * and instrumentations when nobody's listening.
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

import { parseEnv } from '../../config/env.schema.js';

let sdk: NodeSDK | null = null;

export const startTelemetry = (): void => {
  const env = parseEnv();
  if (!env.OTEL_ENABLED) return;

  const exporter = new OTLPTraceExporter({
    url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: process.env['npm_package_version'] ?? '0.0.0',
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy / low-value instrumentations.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Flush on shutdown so we don't lose the last batch of spans.
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, () => {
      void sdk
        ?.shutdown()
        // eslint-disable-next-line no-console
        .catch((err: unknown) => console.error('OTel shutdown error', err));
    });
  }
};
