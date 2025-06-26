import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { MetricsReporter } from "../metricsReporter";
import { logger } from "@/utils/logger";
import { getProjectContext, isProjectContextInitialized } from "@/services/ProjectContext";
import { logLessonMetrics } from "@/utils/lessonMetrics";

// Mock dependencies
mock.module("@/utils/logger", () => ({
    logger: {
        debug: mock(),
        info: mock(),
        error: mock(),
    },
}));

mock.module("@/services/ProjectContext", () => ({
    getProjectContext: mock(),
    isProjectContextInitialized: mock(),
}));

mock.module("@/utils/lessonMetrics", () => ({
    logLessonMetrics: mock(),
}));

describe("MetricsReporter", () => {
    let reporter: MetricsReporter;
    let mockProjectContext: any;
    
    // Track timers
    let setTimeoutSpy: any;
    let setIntervalSpy: any;
    let clearIntervalSpy: any;
    let originalSetTimeout: any;
    let originalSetInterval: any;
    let originalClearInterval: any;
    
    beforeEach(() => {
        // Clear mock calls but don't restore modules
        (logger.debug as any).mockClear();
        (logger.info as any).mockClear();
        (logger.error as any).mockClear();
        (getProjectContext as any).mockClear();
        (isProjectContextInitialized as any).mockClear();
        (logLessonMetrics as any).mockClear();
        
        // Mock project context
        mockProjectContext = {
            getAllLessons: mock(() => []),
        };
        
        (getProjectContext as any).mockReturnValue(mockProjectContext);
        (isProjectContextInitialized as any).mockReturnValue(true);
        
        // Spy on timer functions
        originalSetTimeout = global.setTimeout;
        originalSetInterval = global.setInterval;
        originalClearInterval = global.clearInterval;
        
        setTimeoutSpy = mock((fn: Function, delay: number) => {
            // Call immediately for testing
            if (delay === 5 * 60 * 1000) {
                fn();
            }
            return 123; // Mock timer ID
        });
        
        setIntervalSpy = mock((fn: Function, delay: number) => {
            return 456; // Mock interval ID
        });
        
        clearIntervalSpy = mock();
        
        global.setTimeout = setTimeoutSpy as any;
        global.setInterval = setIntervalSpy as any;
        global.clearInterval = clearIntervalSpy;
    });
    
    afterEach(() => {
        // Restore original timer functions
        global.setTimeout = originalSetTimeout;
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        
        // Stop reporter if running
        if (reporter) {
            reporter.stop();
        }
    });
    
    describe("initialization", () => {
        it("should create reporter with default interval", () => {
            reporter = new MetricsReporter();
            expect(reporter).toBeDefined();
        });
        
        it("should create reporter with custom interval", () => {
            reporter = new MetricsReporter(60); // 60 minutes
            expect(reporter).toBeDefined();
        });
    });
    
    describe("start", () => {
        it("should set up initial timeout and interval", () => {
            reporter = new MetricsReporter();
            reporter.start();
            
            // Check setTimeout was called for initial delay
            expect(setTimeoutSpy).toHaveBeenCalledWith(
                expect.any(Function),
                5 * 60 * 1000 // 5 minutes
            );
            
            // Check setInterval was called
            expect(setIntervalSpy).toHaveBeenCalledWith(
                expect.any(Function),
                30 * 60 * 1000 // Default 30 minutes
            );
            
            expect(logger.debug).toHaveBeenCalledWith(
                "📊 Metrics reporter started",
                { intervalMinutes: 30 }
            );
        });
        
        it("should use custom interval when provided", () => {
            reporter = new MetricsReporter(15); // 15 minutes
            reporter.start();
            
            expect(setIntervalSpy).toHaveBeenCalledWith(
                expect.any(Function),
                15 * 60 * 1000
            );
            
            expect(logger.debug).toHaveBeenCalledWith(
                "📊 Metrics reporter started",
                { intervalMinutes: 15 }
            );
        });
        
        it("should report metrics after initial timeout", () => {
            mockProjectContext.getAllLessons.mockReturnValue([
                { id: "1", title: "Test lesson" },
            ]);
            
            reporter = new MetricsReporter();
            reporter.start();
            
            // setTimeout callback should have been called immediately in our mock
            expect(logger.info).toHaveBeenCalledWith("📊 Periodic lesson metrics report");
            expect(logLessonMetrics).toHaveBeenCalledWith(mockProjectContext);
        });
    });
    
    describe("stop", () => {
        it("should clear interval when stopped", () => {
            reporter = new MetricsReporter();
            reporter.start();
            reporter.stop();
            
            expect(clearIntervalSpy).toHaveBeenCalledWith(456); // Mock interval ID
            expect(logger.debug).toHaveBeenCalledWith("📊 Metrics reporter stopped");
        });
        
        it("should handle stop when not started", () => {
            reporter = new MetricsReporter();
            reporter.stop();
            
            expect(clearIntervalSpy).not.toHaveBeenCalled();
            expect(logger.debug).not.toHaveBeenCalledWith("📊 Metrics reporter stopped");
        });
        
        it("should handle multiple stop calls", () => {
            reporter = new MetricsReporter();
            reporter.start();
            reporter.stop();
            reporter.stop();
            
            expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
            expect(logger.debug).toHaveBeenCalledWith("📊 Metrics reporter stopped");
        });
    });
    
    describe("reportMetrics", () => {
        it("should skip reporting when project context not initialized", () => {
            (isProjectContextInitialized as any).mockReturnValue(false);
            
            reporter = new MetricsReporter();
            reporter.start();
            
            expect(getProjectContext).not.toHaveBeenCalled();
            expect(logLessonMetrics).not.toHaveBeenCalled();
        });
        
        it("should skip reporting when no lessons exist", () => {
            mockProjectContext.getAllLessons.mockReturnValue([]);
            
            reporter = new MetricsReporter();
            reporter.start();
            
            expect(logger.info).not.toHaveBeenCalledWith("📊 Periodic lesson metrics report");
            expect(logLessonMetrics).not.toHaveBeenCalled();
        });
        
        it("should report metrics when lessons exist", () => {
            const mockLessons = [
                { id: "1", title: "Lesson 1" },
                { id: "2", title: "Lesson 2" },
            ];
            mockProjectContext.getAllLessons.mockReturnValue(mockLessons);
            
            reporter = new MetricsReporter();
            reporter.start();
            
            expect(logger.info).toHaveBeenCalledWith("📊 Periodic lesson metrics report");
            expect(logLessonMetrics).toHaveBeenCalledWith(mockProjectContext);
        });
        
        it("should handle errors during reporting", () => {
            mockProjectContext.getAllLessons.mockImplementation(() => {
                throw new Error("Database error");
            });
            
            reporter = new MetricsReporter();
            reporter.start();
            
            expect(logger.error).toHaveBeenCalledWith(
                "Failed to report metrics",
                { error: "Database error" }
            );
            expect(logLessonMetrics).not.toHaveBeenCalled();
        });
        
        it("should handle non-Error exceptions", () => {
            mockProjectContext.getAllLessons.mockImplementation(() => {
                throw "String error";
            });
            
            reporter = new MetricsReporter();
            reporter.start();
            
            expect(logger.error).toHaveBeenCalledWith(
                "Failed to report metrics",
                { error: "String error" }
            );
        });
    });
    
    describe("periodic reporting", () => {
        it("should call report function periodically", () => {
            const mockLessons = [{ id: "1", title: "Test" }];
            mockProjectContext.getAllLessons.mockReturnValue(mockLessons);
            
            // Track interval callback
            let intervalCallback: Function | null = null;
            setIntervalSpy.mockImplementation((fn: Function, delay: number) => {
                intervalCallback = fn;
                return 789;
            });
            
            reporter = new MetricsReporter(1); // 1 minute interval for testing
            reporter.start();
            
            // Clear previous calls from initial timeout
            (logger.info as any).mockClear();
            (logLessonMetrics as any).mockClear();
            
            // Simulate interval callback
            expect(intervalCallback).toBeDefined();
            intervalCallback!();
            
            expect(logger.info).toHaveBeenCalledWith("📊 Periodic lesson metrics report");
            expect(logLessonMetrics).toHaveBeenCalledWith(mockProjectContext);
        });
    });
});