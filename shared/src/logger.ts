export function logError(message: string): void {
    console.error(`❌ ${message}`);
}

export function logInfo(message: string): void {
    console.log(`ℹ️  ${message}`);
}

export function logSuccess(message: string): void {
    console.log(`✅ ${message}`);
}

export function logWarning(message: string): void {
    console.log(`⚠️  ${message}`);
}