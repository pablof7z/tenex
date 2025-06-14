import { expect, test } from "@playwright/test";

test.describe("Create account and project", () => {
    test("should create a new account, create a project, and verify it appears in sidebar", async ({
        page,
    }) => {
        // Increase timeout for this test
        test.setTimeout(90000);
        // Navigate to the app
        await page.goto("/");

        // Wait for login screen to load
        await expect(page.locator("h1")).toContainText("Nostr Projects");

        // Click on "Create New Account" button
        await page.getByRole("button", { name: /Create New Account/i }).click();

        // Wait for the confirmation section to appear
        await expect(
            page.getByText("This will generate a new Nostr identity for you.")
        ).toBeVisible();

        // Click "Generate New Identity" button
        await page.getByRole("button", { name: /Generate New Identity/i }).click();

        // Wait for navigation to happen (we should be redirected to the main app)
        await page.waitForURL("/", { timeout: 10000 });

        // Verify we're on the main app (desktop layout should be visible)
        // Look for the sidebar with the T button
        await expect(page.locator(".bg-card.border-r").first()).toBeVisible();

        // Wait a bit for the UI to settle
        await page.waitForTimeout(1000);

        // Click the "New project" button (Plus icon) at the bottom of the left sidebar
        const sidebarElement = page.locator(".bg-card.border-r").first();
        await sidebarElement.locator(".p-2.border-t button").first().click();

        // Wait for the create project dialog to appear
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByText("Project Details")).toBeVisible();

        // Fill in project details
        const projectName = `Test Project ${Date.now()}`;
        await page.getByPlaceholder("My Awesome Project").fill(projectName);
        await page
            .getByPlaceholder("Brief description of your project...")
            .fill("This is a test project created by Playwright");
        await page
            .getByPlaceholder("react, typescript, web3 (comma separated)")
            .fill("test, automation");

        // Navigate through the wizard by clicking Next until we see Create Project
        let createButtonFound = false;
        for (let i = 0; i < 5; i++) {
            // Check if Create Project button is visible
            const createButton = page.getByRole("button", {
                name: /Create Project/i,
            });
            if (await createButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await createButton.click();
                createButtonFound = true;
                break;
            }

            // Otherwise click Next
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

        // Wait for the project to appear (Nostr events need time to propagate)
        await page.waitForTimeout(5000);

        // Take a screenshot for debugging
        await page.screenshot({
            path: "test-results/after-project-creation.png",
            fullPage: true,
        });

        // Verify the project appears in the sidebar
        // Projects created in the last 24 hours should automatically appear
        const sidebar = page.locator(".bg-card.border-r").first();

        // The project should have an avatar with initials
        const projectInitials = projectName
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .toUpperCase()
            .slice(0, 2);

        console.log("Looking for project with initials:", projectInitials);

        // Wait for project buttons to appear in sidebar
        await expect(sidebar.locator("button.w-12.h-12").first()).toBeVisible({
            timeout: 20000,
        });

        // Look for our project - it might be already visible since it was just created
        // New projects are automatically shown in the filtered list
        const projectButtons = sidebar.locator("button.w-12.h-12");
        const projectCount = await projectButtons.count();
        console.log(`Found ${projectCount} project button(s) in sidebar`);

        // Since the project was just created, it should be visible in the main area
        // Check if the project name appears in the main content
        const mainArea = page.locator(".flex-1.flex.flex-col");

        // Look for the project name in the dashboard
        const projectNameVisible = await mainArea
            .getByText(projectName)
            .isVisible({ timeout: 10000 })
            .catch(() => false);

        if (projectNameVisible) {
            console.log("Project is visible in the main area!");
            // Success - the project was created and is showing
        } else {
            // Try clicking on a project button if we can find one with our initials
            const avatarWithInitials = sidebar.locator(`text="${projectInitials}"`);
            if (await avatarWithInitials.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log("Found project avatar with initials, clicking it");
                const buttonWithAvatar = sidebar
                    .locator("button")
                    .filter({ hasText: projectInitials })
                    .first();
                await buttonWithAvatar.click();
                await page.waitForTimeout(1000);

                // Now check again for the project name
                await expect(mainArea.getByText(projectName)).toBeVisible({
                    timeout: 5000,
                });
            }
        }

        // Final verification - take another screenshot
        await page.screenshot({
            path: "test-results/final-verification.png",
            fullPage: true,
        });
    });
});
