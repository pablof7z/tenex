import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

test.describe("Thread Drawer Debug", () => {
	test("debug thread creation flow", async ({ page }) => {
		// Increase timeout for this test
		test.setTimeout(120000);

		// Navigate to the app
		await page.goto("/");

		// Generate unique identifiers
		const uniqueId = randomBytes(4).toString("hex");
		const projectName = `Test Project ${uniqueId}`;
		const threadTitle = `Test Thread ${uniqueId}`;

		// Step 1: Create a new account
		await test.step("Create new account", async () => {
			// Wait for login screen to load
			await expect(page.locator('h1:has-text("Nostr Projects")')).toBeVisible();
			await page.screenshot({
				path: "test-results/01-login-screen.png",
				fullPage: true,
			});

			// Create new account
			await page.getByRole("button", { name: /Create New Account/i }).click();
			await page.waitForTimeout(500);
			await page.screenshot({
				path: "test-results/02-create-account-dialog.png",
				fullPage: true,
			});

			await expect(
				page.getByText("This will generate a new Nostr identity for you."),
			).toBeVisible();
			await page
				.getByRole("button", { name: /Generate New Identity/i })
				.click();

			// Wait for redirect to main app
			await page.waitForURL("/", { timeout: 10000 });
			await page.waitForTimeout(2000);
			await page.screenshot({
				path: "test-results/03-main-app.png",
				fullPage: true,
			});

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
			await page.screenshot({
				path: "test-results/04-create-project-dialog.png",
				fullPage: true,
			});

			// Fill project name only (minimum required field)
			await page.locator("input#name").fill(projectName);

			// Keep clicking Next until we can create
			let attempts = 0;
			while (attempts < 5) {
				await page.screenshot({
					path: `test-results/05-project-step-${attempts}.png`,
					fullPage: true,
				});

				try {
					// Try to click Create Project if visible
					const createButton = page.getByRole("button", {
						name: /Create Project/i,
					});
					if (await createButton.isVisible({ timeout: 1000 })) {
						await createButton.click();
						break;
					}
				} catch (e) {
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
				} catch (e) {
					break; // No buttons, we might be done
				}

				attempts++;
			}

			// Wait for dialog to close
			await expect(page.getByRole("dialog")).not.toBeVisible({
				timeout: 10000,
			});

			// Wait a bit for project to appear
			await page.waitForTimeout(3000);
			await page.screenshot({
				path: "test-results/06-after-project-creation.png",
				fullPage: true,
			});
		});

		// Step 3: Verify we're on project dashboard
		await test.step("Verify project dashboard", async () => {
			// Wait for project column to appear
			await page.waitForSelector(".w-80.flex-shrink-0", { timeout: 10000 });

			// Verify the project column is visible
			const projectColumn = page
				.locator(".w-80.flex-shrink-0")
				.filter({ hasText: projectName });
			await expect(projectColumn).toBeVisible({ timeout: 10000 });
			await page.screenshot({
				path: "test-results/07-project-dashboard.png",
				fullPage: true,
			});
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
			await page.screenshot({
				path: "test-results/08-task-options-dialog.png",
				fullPage: true,
			});

			// Look for all buttons in the dialog
			const dialogButtons = await page.locator('[role="dialog"] button').all();
			console.log(`Found ${dialogButtons.length} buttons in dialog`);

			for (let i = 0; i < dialogButtons.length; i++) {
				const text = await dialogButtons[i].textContent();
				console.log(`Button ${i}: ${text}`);
			}

			// Select "Thread" option
			await page.locator("button").filter({ hasText: "Thread" }).click();

			// Wait for thread dialog
			await page.waitForTimeout(1000);
			await page.screenshot({
				path: "test-results/09-thread-dialog.png",
				fullPage: true,
			});

			// Enter thread title
			await page.getByPlaceholder(/enter thread title/i).fill(threadTitle);
			await page.screenshot({
				path: "test-results/10-thread-title-entered.png",
				fullPage: true,
			});

			// Click continue
			await page.getByRole("button", { name: /continue/i }).click();

			// Wait a bit to see what happens
			await page.waitForTimeout(2000);
			await page.screenshot({
				path: "test-results/11-after-thread-creation.png",
				fullPage: true,
			});

			// Check if a drawer (sheet) opened
			const sheetExists = (await page.locator('[role="sheet"]').count()) > 0;
			console.log(`Sheet exists: ${sheetExists}`);

			if (sheetExists) {
				console.log("Drawer opened successfully!");
				await page.screenshot({
					path: "test-results/12-drawer-opened.png",
					fullPage: true,
				});
			} else {
				console.log("No drawer found, checking for other elements...");

				// Check for any dialogs
				const dialogExists =
					(await page.locator('[role="dialog"]').count()) > 0;
				console.log(`Dialog exists: ${dialogExists}`);

				// Check what's visible on the page
				const visibleText = await page.locator("body").textContent();
				console.log("Page contains:", visibleText?.substring(0, 500));
			}
		});

		// Take final screenshot
		await page.screenshot({
			path: "test-results/99-final-state.png",
			fullPage: true,
		});
	});
});
