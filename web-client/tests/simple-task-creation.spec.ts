import { expect, test } from "@playwright/test";

test.describe("Simple task creation test", () => {
    test("should create account, project, and show task options dialog", async ({ page }) => {
        // Increase timeout
        test.setTimeout(60000);

        // Navigate to the app
        await page.goto("/");

        // Create new account
        await expect(page.locator('h1:has-text("Nostr Projects")')).toBeVisible();
        await page.getByRole("button", { name: /Create New Account/i }).click();
        await expect(
            page.getByText("This will generate a new Nostr identity for you.")
        ).toBeVisible();
        await page.getByRole("button", { name: /Generate New Identity/i }).click();

        // Wait for redirect to main app
        await page.waitForURL("/", { timeout: 10000 });

        // Verify we're in the app
        const sidebar = page.locator(".bg-card.border-r").first();
        await expect(sidebar).toBeVisible();

        // Create a new project
        await sidebar
            .locator("button")
            .filter({ has: page.locator("svg") })
            .first()
            .click();
        await expect(page.getByRole("dialog")).toBeVisible();

        // Fill project name
        const projectName = `Test ${Date.now()}`;
        await page.locator("input#name").fill(projectName);

        // Navigate to create project
        for (let i = 0; i < 5; i++) {
            const createButton = page.getByRole("button", {
                name: /Create Project/i,
            });
            if (await createButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await createButton.click();
                break;
            }

            const nextButton = page.getByRole("button", { name: /Next/i });
            if (await nextButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await nextButton.click();
                await page.waitForTimeout(500);
            }
        }

        // Wait for dialog to close
        await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

        // Wait for project to appear and be rendered
        await page.waitForTimeout(7000);

        // Take screenshot to see current state
        await page.screenshot({
            path: "test-results/before-task-creation.png",
            fullPage: true,
        });

        // Look for any project column with a + button
        // Projects are in columns with class .w-80.flex-shrink-0
        const projectColumns = page.locator(".w-80.flex-shrink-0");
        const columnCount = await projectColumns.count();
        console.log(`Found ${columnCount} project column(s)`);

        if (columnCount > 0) {
            // Click the + button in the first project column we find
            const firstColumn = projectColumns.first();
            const plusButton = firstColumn.locator('button[title="Create new task"]').first();

            // Wait for the button to be visible and click it
            await expect(plusButton).toBeVisible({ timeout: 10000 });
            await plusButton.click();

            // Verify task options dialog appears
            await expect(page.getByRole("dialog")).toBeVisible();
            await expect(page.getByText("Create New")).toBeVisible();

            // Verify all three options are present
            const newTaskButton = page.getByRole("button").filter({ hasText: "New Task" });
            const voiceButton = page.getByRole("button").filter({ hasText: "Voice" });
            const threadButton = page.getByRole("button").filter({ hasText: "Thread" });

            await expect(newTaskButton).toBeVisible();
            await expect(voiceButton).toBeVisible();
            await expect(threadButton).toBeVisible();

            console.log("Task creation dialog successfully opened with all options!");

            // Take final screenshot
            await page.screenshot({
                path: "test-results/task-options-dialog.png",
                fullPage: true,
            });
        } else {
            throw new Error("No project columns found after creating project");
        }
    });
});
