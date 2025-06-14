import { expect, test } from "@playwright/test";

test.describe("Task creation flow", () => {
    test("should create a new account, project, and task", async ({ page }) => {
        // Increase timeout for this test
        test.setTimeout(90000);

        // Navigate to the app
        await page.goto("/");

        // Wait for login screen to load
        await expect(page.locator('h1:has-text("Nostr Projects")')).toBeVisible();

        // Create new account
        await page.getByRole("button", { name: /Create New Account/i }).click();
        await expect(
            page.getByText("This will generate a new Nostr identity for you.")
        ).toBeVisible();
        await page.getByRole("button", { name: /Generate New Identity/i }).click();

        // Wait for redirect to main app
        await page.waitForURL("/", { timeout: 10000 });

        // Verify we're in the app (look for sidebar)
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
        const projectName = `Test Project ${Date.now()}`;
        await page.locator("input#name").fill(projectName);

        // Navigate through wizard to create project
        let createButtonFound = false;
        for (let i = 0; i < 5; i++) {
            const createButton = page.getByRole("button", {
                name: /Create Project/i,
            });
            if (await createButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await createButton.click();
                createButtonFound = true;
                break;
            }

            const nextButton = page.getByRole("button", { name: /Next/i });
            if (await nextButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await nextButton.click();
                await page.waitForTimeout(500);
            } else {
                break;
            }
        }

        if (!createButtonFound) {
            throw new Error("Could not find Create Project button");
        }

        // Wait for dialog to close
        await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

        // Wait for project to appear
        await page.waitForTimeout(5000);

        // Project should be visible in the main area (newly created projects are automatically shown)
        const mainArea = page.locator(".flex-1.flex.flex-col");
        await expect(mainArea.getByText(projectName)).toBeVisible({
            timeout: 15000,
        });

        // Find the project column header with the + button
        const projectColumn = page.locator(".w-80.flex-shrink-0").filter({ hasText: projectName });
        await expect(projectColumn).toBeVisible();

        // Click the + button in the project column header
        const plusButton = projectColumn
            .locator(".p-4.bg-card")
            .locator('button[title="Create new task"]')
            .first();
        await expect(plusButton).toBeVisible();
        await plusButton.click();

        // Task creation options dialog should appear
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByText("Create New")).toBeVisible();

        // Verify the three options are available
        await expect(page.getByRole("button").filter({ hasText: "New Task" })).toBeVisible();
        await expect(page.getByRole("button").filter({ hasText: "Voice" })).toBeVisible();
        await expect(page.getByRole("button").filter({ hasText: "Thread" })).toBeVisible();

        // Click on "New Task"
        await page.getByRole("button").filter({ hasText: "New Task" }).click();

        // Wait for task creation dialog
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByText("New Task")).toBeVisible();

        // Fill in task details
        const taskTitle = `Test Task ${Date.now()}`;
        await page.getByPlaceholder("Enter task title...").fill(taskTitle);
        await page
            .getByPlaceholder("Enter task description...")
            .fill("This is a test task created by Playwright");

        // Create the task
        await page.getByRole("button", { name: /Create/i }).click();

        // Wait for dialog to close
        await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

        // Wait for task to appear
        await page.waitForTimeout(3000);

        // Verify the task appears in the project column
        await expect(projectColumn.getByText("Recent Tasks")).toBeVisible();
        await expect(projectColumn.getByText(taskTitle)).toBeVisible({
            timeout: 10000,
        });

        // Take screenshot for verification
        await page.screenshot({
            path: "test-results/task-created.png",
            fullPage: true,
        });

        console.log(`Successfully created project "${projectName}" and task "${taskTitle}"`);
    });
});
