import {
    TELEMETRY_PROVIDERS,
    type TelemetryConfig,
    type TelemetryProvider,
} from "@tenex/types/telemetry";
import { AlertCircle, BookOpen, Check, Settings, Zap } from "lucide-react";
import { useState } from "react";
import type { ProjectFormData } from "../../types/template";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

interface TelemetrySelectionStepProps {
    formData: ProjectFormData;
    onFormDataChange: (data: Partial<ProjectFormData>) => void;
}

export function TelemetrySelectionStep({
    formData,
    onFormDataChange,
}: TelemetrySelectionStepProps) {
    const [selectedProvider, setSelectedProvider] = useState<TelemetryProvider | null>(null);
    const [serviceName, setServiceName] = useState(formData.name || "");
    const [enabledFeatures, setEnabledFeatures] = useState<string[]>(["tracing"]);
    const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
    const [customEndpoints, setCustomEndpoints] = useState<Record<string, string>>({});

    const handleEnableTelemetry = (enabled: boolean) => {
        onFormDataChange({ enableTelemetry: enabled });

        if (!enabled) {
            onFormDataChange({ telemetryConfig: undefined });
            setSelectedProvider(null);
            setEnabledFeatures([]);
        }
    };

    const handleProviderSelect = (providerName: string) => {
        const provider = TELEMETRY_PROVIDERS.find((p) => p.name === providerName);
        setSelectedProvider(provider || null);
        setAuthHeaders({});
        setCustomEndpoints({});
    };

    const handleFeatureToggle = (feature: string, enabled: boolean) => {
        const newFeatures = enabled
            ? [...enabledFeatures, feature]
            : enabledFeatures.filter((f) => f !== feature);
        setEnabledFeatures(newFeatures);
    };

    const handleAuthHeaderChange = (headerName: string, value: string) => {
        setAuthHeaders((prev) => ({
            ...prev,
            [headerName]: value,
        }));
    };

    const handleCustomEndpointChange = (endpointType: string, value: string) => {
        setCustomEndpoints((prev) => ({
            ...prev,
            [endpointType]: value,
        }));
    };

    const generateTelemetryConfig = (): TelemetryConfig => {
        if (!selectedProvider) return {};

        const config: TelemetryConfig = {};
        const baseConfig = {
            serviceName: serviceName || formData.name,
            serviceVersion: "1.0.0",
            environment: "development",
        };

        if (enabledFeatures.includes("tracing")) {
            config.tracing = {
                enabled: true,
                ...baseConfig,
                endpoint:
                    selectedProvider.name === "custom"
                        ? customEndpoints.tracing
                        : selectedProvider.tracingEndpoint,
                protocol: selectedProvider.protocol,
                ...(selectedProvider.requiresAuth &&
                    Object.keys(authHeaders).length > 0 && {
                        headers: authHeaders,
                    }),
            };
        }

        if (enabledFeatures.includes("metrics")) {
            config.metrics = {
                enabled: true,
                ...baseConfig,
                endpoint:
                    selectedProvider.name === "custom"
                        ? customEndpoints.metrics
                        : selectedProvider.metricsEndpoint,
                protocol: selectedProvider.protocol,
                ...(selectedProvider.requiresAuth &&
                    Object.keys(authHeaders).length > 0 && {
                        headers: authHeaders,
                    }),
            };
        }

        if (enabledFeatures.includes("logs")) {
            config.logs = {
                enabled: true,
                ...baseConfig,
                endpoint:
                    selectedProvider.name === "custom"
                        ? customEndpoints.logs
                        : selectedProvider.logsEndpoint,
                protocol: selectedProvider.protocol,
                ...(selectedProvider.requiresAuth &&
                    Object.keys(authHeaders).length > 0 && {
                        headers: authHeaders,
                    }),
            };
        }

        return config;
    };

    const handleApplyConfig = () => {
        const config = generateTelemetryConfig();
        onFormDataChange({ telemetryConfig: config });
    };

    const isConfigValid = () => {
        if (!formData.enableTelemetry) return true;
        if (!selectedProvider) return false;
        if (enabledFeatures.length === 0) return false;

        if (selectedProvider.name === "custom") {
            return enabledFeatures.every((feature) => {
                const endpoint = customEndpoints[feature];
                return endpoint && endpoint.trim().length > 0;
            });
        }

        if (selectedProvider.requiresAuth) {
            return (
                selectedProvider.authHeaders?.every(
                    (header) => authHeaders[header] && authHeaders[header].trim().length > 0
                ) ?? false
            );
        }

        return true;
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium">OpenTelemetry Configuration</h3>
                        <p className="text-sm text-muted-foreground">
                            Optionally configure observability for your project
                        </p>
                    </div>
                    <Switch
                        checked={formData.enableTelemetry || false}
                        onCheckedChange={handleEnableTelemetry}
                    />
                </div>

                {!formData.enableTelemetry && (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Telemetry is disabled. Enable it to monitor your project's performance
                            and behavior.
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {formData.enableTelemetry && (
                <div className="space-y-6">
                    {/* Service Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Service Configuration
                            </CardTitle>
                            <CardDescription>
                                Basic service information for telemetry data
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="serviceName">Service Name</Label>
                                <Input
                                    id="serviceName"
                                    value={serviceName}
                                    onChange={(e) => setServiceName(e.target.value)}
                                    placeholder="my-tenex-project"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Provider Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5" />
                                Telemetry Provider
                            </CardTitle>
                            <CardDescription>
                                Choose where to send your telemetry data
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="provider">Provider</Label>
                                <Select onValueChange={handleProviderSelect}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a telemetry provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TELEMETRY_PROVIDERS.map((provider) => (
                                            <SelectItem key={provider.name} value={provider.name}>
                                                <div className="flex items-center justify-between w-full">
                                                    <span>{provider.displayName}</span>
                                                    {provider.requiresAuth && (
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            (auth required)
                                                        </span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedProvider && (
                                <div className="space-y-4">
                                    {selectedProvider.documentation && (
                                        <Alert>
                                            <BookOpen className="h-4 w-4" />
                                            <AlertDescription className="flex items-center justify-between">
                                                <span>
                                                    View setup documentation for{" "}
                                                    {selectedProvider.displayName}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        window.open(
                                                            selectedProvider.documentation,
                                                            "_blank"
                                                        )
                                                    }
                                                >
                                                    <BookOpen className="h-4 w-4 mr-2" />
                                                    Docs
                                                </Button>
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {/* Feature Selection */}
                                    <div>
                                        <Label>Telemetry Features</Label>
                                        <div className="space-y-2 mt-2">
                                            {[
                                                {
                                                    id: "tracing",
                                                    label: "Tracing",
                                                    description: "Distributed tracing for requests",
                                                },
                                                {
                                                    id: "metrics",
                                                    label: "Metrics",
                                                    description: "Application and system metrics",
                                                },
                                                {
                                                    id: "logs",
                                                    label: "Logs",
                                                    description: "Structured application logs",
                                                },
                                            ].map((feature) => (
                                                <div
                                                    key={feature.id}
                                                    className="flex items-start space-x-3"
                                                >
                                                    <Checkbox
                                                        id={feature.id}
                                                        checked={enabledFeatures.includes(
                                                            feature.id
                                                        )}
                                                        onCheckedChange={(checked) =>
                                                            handleFeatureToggle(
                                                                feature.id,
                                                                checked === true
                                                            )
                                                        }
                                                        disabled={
                                                            selectedProvider.name !== "custom" &&
                                                            !selectedProvider[
                                                                `${feature.id}Endpoint` as keyof TelemetryProvider
                                                            ]
                                                        }
                                                    />
                                                    <div className="grid gap-1.5 leading-none">
                                                        <Label
                                                            htmlFor={feature.id}
                                                            className="font-medium"
                                                        >
                                                            {feature.label}
                                                        </Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            {feature.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Custom Endpoints */}
                                    {selectedProvider.name === "custom" &&
                                        enabledFeatures.length > 0 && (
                                            <div className="space-y-3">
                                                <Label>Custom Endpoints</Label>
                                                {enabledFeatures.map((feature) => (
                                                    <div key={feature}>
                                                        <Label
                                                            htmlFor={`${feature}-endpoint`}
                                                            className="text-sm"
                                                        >
                                                            {feature.charAt(0).toUpperCase() +
                                                                feature.slice(1)}{" "}
                                                            Endpoint
                                                        </Label>
                                                        <Input
                                                            id={`${feature}-endpoint`}
                                                            value={customEndpoints[feature] || ""}
                                                            onChange={(e) =>
                                                                handleCustomEndpointChange(
                                                                    feature,
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder={`https://your-${feature}-endpoint.com/v1/${feature}`}
                                                            type="url"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                    {/* Authentication */}
                                    {selectedProvider.requiresAuth &&
                                        selectedProvider.authHeaders && (
                                            <div className="space-y-3">
                                                <Label>Authentication</Label>
                                                {selectedProvider.authHeaders.map((headerName) => (
                                                    <div key={headerName}>
                                                        <Label
                                                            htmlFor={headerName}
                                                            className="text-sm"
                                                        >
                                                            {headerName}
                                                        </Label>
                                                        <Input
                                                            id={headerName}
                                                            type="password"
                                                            value={authHeaders[headerName] || ""}
                                                            onChange={(e) =>
                                                                handleAuthHeaderChange(
                                                                    headerName,
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder={`Enter your ${headerName}`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                    {/* Apply Configuration */}
                                    <div className="flex items-center justify-between pt-4 border-t">
                                        <div className="text-sm text-muted-foreground">
                                            {isConfigValid() ? (
                                                <span className="flex items-center text-green-600">
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Configuration is valid
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-amber-600">
                                                    <AlertCircle className="h-4 w-4 mr-1" />
                                                    Please complete the configuration
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            onClick={handleApplyConfig}
                                            disabled={!isConfigValid()}
                                            size="sm"
                                        >
                                            Apply Configuration
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
