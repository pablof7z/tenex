import { expect, test } from "@playwright/test";

test.describe("Simple project creation test", () => {
    test("should create a new account and project", async ({ page }) => {
        // Increase timeout for this test
        test.setTimeout(60000);

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

        // Find and click the create project button (Plus icon)
        await sidebar
            .locator("button")
            .filter({ has: page.locator("svg") })
            .first()
            .click();

        // Wait for dialog
        await expect(page.getByRole("dialog")).toBeVisible();

        // Fill project name only (minimum required field)
        const projectName = `Test ${Date.now()}`;
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

            // Otherwise click Next
            try {
                await page.getByRole("button", { name: /Next/i }).click();
                await page.waitForTimeout(500);
            } catch (_e) {
                break; // No next button, we might be done
            }

            attempts++;
        }

        // Wait for dialog to close
        await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

        // Success - project was created
        console.log(`Created project: ${projectName}`);

        // Wait a bit for project to appear
        await page.waitForTimeout(5000);

        // Take screenshot for debugging
        await page.screenshot({
            path: "test-results/final-state.png",
            fullPage: true,
        });
    });
});
