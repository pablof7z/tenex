import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

test.describe("Thread Drawer Functionality", () => {
    test("should create account, project, thread and open thread in drawer", async ({ page }) => {
        // Increase timeout for this test
        test.setTimeout(90000);

        // Navigate to the app
        await page.goto("/");

        // Generate unique identifiers
        const uniqueId = randomBytes(4).toString("hex");
        const projectName = `Test Project ${uniqueId}`;
        const threadTitle = `Test Thread ${uniqueId}`;
        const threadContent = `This is a test thread created at ${new Date().toISOString()}`;

        // Step 1: Create a new account
        await test.step("Create new account", async () => {
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
        });

        // Step 2: Create a new project
        await test.step("Create new project", async () => {
            // Find and click the create project button (Plus icon) in sidebar
            const sidebar = page.locator(".bg-card.border-r").first();
            await sidebar
                .locator("button")
                .filter({ has: page.locator("svg") })
                .first()
                .click();

            // Wait for dialog
            await expect(page.getByRole("dialog")).toBeVisible();

            // Fill project name only (minimum required field)
            await page.locator("input#name").fill(projectName);

            // Keep clicking Next until we can create
            let attempts = 0;
            while (attempts < 5) {
                try {
                    // Try to click Create Project if visible
                    const createButton = page.getByRole("button", {
                        name: /Create Project/i,
                    });
                    if (await createButton.isVisible({ timeout: 1000 })) {
                        await createButton.click();
                        break;
                    }
                } catch (_e) {
                    // Not on final step yet
                }

                // Otherwise click Next or Skip
                try {
                    const nextButton = page.getByRole("button", { name: /Next/i });
                    const skipButton = page.getByRole("button", { name: /Skip/i });

                    if (await skipButton.isVisible({ timeout: 500 })) {
                        await skipButton.click();
                    } else if (await nextButton.isVisible({ timeout: 500 })) {
                        await nextButton.click();
                    }

                    await page.waitForTimeout(500);
                } catch (_e) {
                    break; // No buttons, we might be done
                }

                attempts++;
            }

            // Wait for dialog to close
            await expect(page.getByRole("dialog")).not.toBeVisible({
                timeout: 10000,
            });

            // Wait a bit for project to appear
            await page.waitForTimeout(2000);
        });

        // Step 3: Verify we're on project dashboard
        await test.step("Verify project dashboard", async () => {
            // We should already be on the dashboard after creating the project
            // Wait for project column to appear
            await page.waitForSelector(".w-80.flex-shrink-0", { timeout: 10000 });

            // Verify the project column is visible
            const projectColumn = page
                .locator(".w-80.flex-shrink-0")
                .filter({ hasText: projectName });
            await expect(projectColumn).toBeVisible({ timeout: 10000 });
        });

        // Step 4: Create a thread
        await test.step("Create a thread", async () => {
            // Find the project column
            const projectColumn = page
                .locator(".w-80.flex-shrink-0")
                .filter({ hasText: projectName });

            // Click the plus button in the project column
            await projectColumn.locator('button[title="Create new task"]').click();

            // Wait for task options dialog
            await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

            // Select "Thread" option (look for the button that contains "Thread" text)
            await page.locator("button").filter({ hasText: "Thread" }).click();

            // Wait for thread dialog
            await page.waitForTimeout(500);

            // Enter thread title
            await page.getByPlaceholder(/enter thread title/i).fill(threadTitle);

            // Click continue
            await page.getByRole("button", { name: /continue/i }).click();

            // Wait for the thread dialog to close and drawer to open
            await page.waitForTimeout(1000);

            // Verify the drawer opens with the thread
            await expect(page.locator('[role="sheet"]')).toBeVisible({
                timeout: 5000,
            });

            // Type the thread content
            await page.getByPlaceholder(/share your thoughts/i).fill(threadContent);

            // Send the message
            await page.keyboard.press("Enter");

            // Wait for message to be sent
            await page.waitForTimeout(1000);

            // Close the drawer
            await page.keyboard.press("Escape");

            // Wait for drawer to close
            await page.waitForTimeout(500);
        });

        // Step 5: Verify thread appears in project column and click it
        await test.step("Click thread to open in drawer", async () => {
            // Find the project column
            const projectColumn = page
                .locator(".w-80.flex-shrink-0")
                .filter({ hasText: projectName });

            // Wait for the thread to appear in the project column (it's in a ThreadOverview component)
            // Look for the thread title in the h4 element within the thread overview
            const threadElement = projectColumn.locator("h4").filter({ hasText: threadTitle });
            await expect(threadElement).toBeVisible({ timeout: 20000 });

            // Click on the thread overview (the parent div is clickable)
            await threadElement.locator("..").locator("..").locator("..").click();

            // Verify the drawer opens
            await expect(page.locator('[role="sheet"]')).toBeVisible({
                timeout: 5000,
            });

            // Verify the thread title is shown in the drawer
            await expect(
                page.locator('[role="sheet"]').locator("h1", { hasText: threadTitle })
            ).toBeVisible();

            // Verify the thread content is visible
            await expect(
                page.locator('[role="sheet"]').locator(`text=${threadContent}`)
            ).toBeVisible();

            // Verify it says "Thread discussion" under the title
            await expect(
                page.locator('[role="sheet"]').locator("text=Thread discussion")
            ).toBeVisible();
        });

        // Step 6: Test drawer functionality
        await test.step("Test drawer functionality", async () => {
            // Type a reply
            const replyText = `Reply to thread at ${new Date().toISOString()}`;
            await page.getByPlaceholder(/share your thoughts/i).fill(replyText);
            await page.keyboard.press("Enter");

            // Wait for reply to be sent
            await page.waitForTimeout(1000);

            // Verify reply appears
            await expect(page.locator('[role="sheet"]').locator(`text=${replyText}`)).toBeVisible({
                timeout: 5000,
            });

            // Close the drawer by clicking the back button
            await page.locator('[role="sheet"]').getByRole("button").first().click();

            // Verify drawer is closed
            await expect(page.locator('[role="sheet"]')).not.toBeVisible({
                timeout: 2000,
            });

            // Verify thread is still visible in the project column
            const projectColumnFinal = page
                .locator(".w-80.flex-shrink-0")
                .filter({ hasText: projectName });
            const threadElementFinal = projectColumnFinal
                .locator("h4")
                .filter({ hasText: threadTitle });
            await expect(threadElementFinal).toBeVisible();
        });

        // Take final screenshot for debugging
        await page.screenshot({
            path: "test-results/thread-drawer-final.png",
            fullPage: true,
        });
    });
});
