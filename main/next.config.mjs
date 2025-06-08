import MiniCssExtractPlugin from "mini-css-extract-plugin";

let userConfig = undefined;
try {
    // try to import ESM first
    userConfig = await import("./v0-user-next.config.mjs");
} catch (e) {
    try {
        // fallback to CJS import
        userConfig = await import("./v0-user-next.config");
    } catch (innerError) {
        // ignore error
    }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        unoptimized: true,
    },
    experimental: {
        webpackBuildWorker: true,
        parallelServerBuildTraces: true,
        parallelServerCompiles: true,
    },
    webpack: (config, { isServer }) => {
        // Ensure CSS is handled properly
        if (!isServer) {
            // This ensures that CSS extraction works properly
            if (!config.plugins.find((plugin) => plugin.constructor.name === "MiniCssExtractPlugin")) {
                config.plugins.push(new MiniCssExtractPlugin());
            }
        }
        return config;
    },
};

if (userConfig) {
    // ESM imports will have a "default" property
    const config = userConfig.default || userConfig;

    for (const key in config) {
        if (typeof nextConfig[key] === "object" && !Array.isArray(nextConfig[key])) {
            nextConfig[key] = {
                ...nextConfig[key],
                ...config[key],
            };
        } else {
            nextConfig[key] = config[key];
        }
    }
}

export default nextConfig;
