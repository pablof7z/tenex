/**
 * OpenTelemetry configuration types
 */

export type TelemetryProtocol = "grpc" | "http/protobuf" | "http/json";

export interface BaseTelemetryConfig {
    enabled: boolean;
    serviceName?: string;
    serviceVersion?: string;
    environment?: string;
}

export interface TracingConfig extends BaseTelemetryConfig {
    endpoint?: string;
    protocol?: TelemetryProtocol;
    headers?: Record<string, string>;
    compression?: "gzip" | "none";
    timeout?: number;
    batchTimeout?: number;
    maxExportBatchSize?: number;
    maxQueueSize?: number;
    exportTimeout?: number;
}

export interface MetricsConfig extends BaseTelemetryConfig {
    endpoint?: string;
    protocol?: TelemetryProtocol;
    headers?: Record<string, string>;
    compression?: "gzip" | "none";
    timeout?: number;
    exportInterval?: number;
    exportTimeout?: number;
}

export interface LogsConfig extends BaseTelemetryConfig {
    endpoint?: string;
    protocol?: TelemetryProtocol;
    headers?: Record<string, string>;
    compression?: "gzip" | "none";
    timeout?: number;
    batchTimeout?: number;
    maxExportBatchSize?: number;
    maxQueueSize?: number;
    exportTimeout?: number;
}

export interface TelemetryConfig {
    tracing?: TracingConfig;
    metrics?: MetricsConfig;
    logs?: LogsConfig;
}

/**
 * Telemetry configuration for projects
 */
export interface TelemetryConfigs {
    default?: string | TelemetryConfig;
    [configName: string]: string | TelemetryConfig | undefined;
}

/**
 * Common OpenTelemetry providers
 */
export interface TelemetryProvider {
    name: string;
    displayName: string;
    tracingEndpoint?: string;
    metricsEndpoint?: string;
    logsEndpoint?: string;
    protocol: TelemetryProtocol;
    requiresAuth: boolean;
    authHeaders?: string[];
    documentation?: string;
}

export const TELEMETRY_PROVIDERS: TelemetryProvider[] = [
    {
        name: "jaeger",
        displayName: "Jaeger",
        tracingEndpoint: "http://localhost:14268/api/traces",
        protocol: "http/protobuf",
        requiresAuth: false,
        documentation: "https://www.jaegertracing.io/",
    },
    {
        name: "zipkin",
        displayName: "Zipkin",
        tracingEndpoint: "http://localhost:9411/api/v2/spans",
        protocol: "http/json",
        requiresAuth: false,
        documentation: "https://zipkin.io/",
    },
    {
        name: "honeycomb",
        displayName: "Honeycomb",
        tracingEndpoint: "https://api.honeycomb.io/v1/traces",
        metricsEndpoint: "https://api.honeycomb.io/v1/metrics",
        protocol: "http/protobuf",
        requiresAuth: true,
        authHeaders: ["x-honeycomb-team"],
        documentation: "https://docs.honeycomb.io/getting-data-in/opentelemetry/",
    },
    {
        name: "newrelic",
        displayName: "New Relic",
        tracingEndpoint: "https://otlp.nr-data.net/v1/traces",
        metricsEndpoint: "https://otlp.nr-data.net/v1/metrics",
        logsEndpoint: "https://otlp.nr-data.net/v1/logs",
        protocol: "http/protobuf",
        requiresAuth: true,
        authHeaders: ["api-key"],
        documentation:
            "https://docs.newrelic.com/docs/more-integrations/open-source-telemetry-integrations/opentelemetry/",
    },
    {
        name: "datadog",
        displayName: "Datadog",
        tracingEndpoint: "https://trace.agent.datadoghq.com/v0.4/traces",
        metricsEndpoint: "https://api.datadoghq.com/api/v2/series",
        protocol: "http/protobuf",
        requiresAuth: true,
        authHeaders: ["DD-API-KEY"],
        documentation:
            "https://docs.datadoghq.com/tracing/other_telemetry/connect_logs_and_traces/opentelemetry/",
    },
    {
        name: "grafana",
        displayName: "Grafana Cloud",
        tracingEndpoint: "https://tempo-prod-04-prod-us-east-0.grafana.net/tempo/api/push",
        metricsEndpoint: "https://prometheus-prod-01-prod-us-east-0.grafana.net/api/prom/push",
        protocol: "http/protobuf",
        requiresAuth: true,
        authHeaders: ["Authorization"],
        documentation: "https://grafana.com/docs/grafana-cloud/send-data/otlp/",
    },
    {
        name: "custom",
        displayName: "Custom OTLP Endpoint",
        protocol: "http/protobuf",
        requiresAuth: false,
        documentation: "https://opentelemetry.io/docs/specs/otlp/",
    },
];
