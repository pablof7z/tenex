import { getProjectContext, isProjectContextInitialized } from "@/services/ProjectContext";
import { logLessonMetrics } from "@/utils/lessonMetrics";
import { logger } from "@/utils/logger";

/**
 * Periodically report lesson metrics for monitoring
 */
export class MetricsReporter {
    private intervalId?: NodeJS.Timeout;
    private readonly intervalMs: number;

    constructor(intervalMinutes = 30) {
        this.intervalMs = intervalMinutes * 60 * 1000;
    }

    start(): void {
        // Initial metrics after 5 minutes
        setTimeout(
            () => {
                this.reportMetrics();
            },
            5 * 60 * 1000
        );

        // Then every interval
        this.intervalId = setInterval(() => {
            this.reportMetrics();
        }, this.intervalMs);

        logger.debug("📊 Metrics reporter started", {
            intervalMinutes: this.intervalMs / 60000,
        });
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
            logger.debug("📊 Metrics reporter stopped");
        }
    }

    private reportMetrics(): void {
        try {
            if (!isProjectContextInitialized()) {
                return;
            }

            const projectCtx = getProjectContext();
            const totalLessons = projectCtx.getAllLessons().length;

            if (totalLessons > 0) {
                logger.info("📊 Periodic lesson metrics report");
                logLessonMetrics(projectCtx);
            }
        } catch (error) {
            logger.error("Failed to report metrics", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
