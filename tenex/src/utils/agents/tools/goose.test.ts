import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";
import { EventEmitter } from "node:events";
import * as childProcess from "node:child_process";

describe("goose tool", () => {
    let mockProcess: any;
    let spawnSpy: any;
    
    beforeEach(() => {
        // Create a mock process
        mockProcess = new EventEmitter();
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = mock(() => {});
        
        // Spy on spawn and return our mock process
        spawnSpy = spyOn(childProcess, "spawn").mockReturnValue(mockProcess as any);
    });
    
    // Import goose after setting up the mock
    const { goose } = require("./goose");
    
    it("should have correct metadata", () => {
        expect(goose.name).toBe("goose");
        expect(goose.description).toContain("Execute complex tasks with Goose AI agent");
        expect(goose.description).toContain("browser automation");
        expect(goose.description).toContain("multi-step workflows");
    });
    
    it("should execute simple task successfully", async () => {
        const resultPromise = goose.execute({ task: "Take a screenshot of example.com" });
        
        // Give the promise a moment to register handlers
        await new Promise(resolve => setImmediate(resolve));
        
        // Simulate successful output
        mockProcess.stdout.emit("data", Buffer.from("Screenshot saved to screenshot.png\n"));
        mockProcess.emit("exit", 0);
        
        const result = await resultPromise;
        
        expect(spawnSpy).toHaveBeenCalledWith("goose", ["run", "Take a screenshot of example.com"], {
            env: expect.objectContaining({
                GOOSE_LOG_LEVEL: "info",
            }),
        });
        
        expect(result).toEqual({
            success: true,
            data: "Screenshot saved to screenshot.png",
        });
    });
    
    it("should execute task with recipe configuration", async () => {
        const recipe = {
            instructions: "Be thorough and take multiple screenshots",
            extensions: ["puppeteer", "screenshot"],
        };
        
        const resultPromise = goose.execute({ 
            task: "Test the checkout flow",
            recipe,
        });
        
        await new Promise(resolve => setImmediate(resolve));
        
        mockProcess.stdout.emit("data", Buffer.from("Checkout flow tested successfully"));
        mockProcess.emit("exit", 0);
        
        const result = await resultPromise;
        
        const expectedRecipe = JSON.stringify({
            version: "1.0.0",
            title: "TENEX Agent Task",
            description: "Test the checkout flow",
            instructions: "Be thorough and take multiple screenshots",
            extensions: ["puppeteer", "screenshot"],
        });
        
        expect(spawnSpy).toHaveBeenCalledWith("goose", ["run", "--recipe", expectedRecipe], {
            env: expect.objectContaining({
                GOOSE_LOG_LEVEL: "info",
            }),
        });
        
        expect(result.success).toBe(true);
    });
    
    it("should handle process errors", async () => {
        const resultPromise = goose.execute({ task: "Test something" });
        
        await new Promise(resolve => setImmediate(resolve));
        
        mockProcess.emit("error", new Error("Command not found"));
        
        const result = await resultPromise;
        
        expect(result).toEqual({
            success: false,
            error: "Failed to start Goose: Command not found. Make sure Goose is installed.",
        });
    });
    
    it("should handle non-zero exit codes", async () => {
        const resultPromise = goose.execute({ task: "Invalid task" });
        
        await new Promise(resolve => setImmediate(resolve));
        
        mockProcess.stderr.emit("data", Buffer.from("Error: Task failed"));
        mockProcess.emit("exit", 1);
        
        const result = await resultPromise;
        
        expect(result).toEqual({
            success: false,
            error: "Error: Task failed",
            data: "", // Empty stdout
        });
    });
    
    it("should include partial output on failure", async () => {
        const resultPromise = goose.execute({ task: "Complex task" });
        
        await new Promise(resolve => setImmediate(resolve));
        
        mockProcess.stdout.emit("data", Buffer.from("Started processing...\n"));
        mockProcess.stdout.emit("data", Buffer.from("Step 1 complete\n"));
        mockProcess.stderr.emit("data", Buffer.from("Error in step 2"));
        mockProcess.emit("exit", 1);
        
        const result = await resultPromise;
        
        expect(result).toEqual({
            success: false,
            error: "Error in step 2",
            data: "Started processing...\nStep 1 complete",
        });
    });
    
    it("should handle timeout protection", async () => {
        const resultPromise = goose.execute({ task: "Long running task" });
        
        await new Promise(resolve => setImmediate(resolve));
        
        // Don't emit exit event, let the code handle it
        // In a real scenario, the timeout would fire after 5 minutes
        // For testing, we'll just simulate what happens when process is killed
        mockProcess.emit("exit", null);
        
        const result = await resultPromise;
        
        expect(result).toEqual({
            success: false,
            error: "Goose exited with code null",
            data: "",
        });
    });
    
    it("should stream progress to context", async () => {
        const onProgress = mock(() => {});
        const context = { onProgress };
        
        const resultPromise = goose.execute({ task: "Progressive task" }, context as any);
        
        await new Promise(resolve => setImmediate(resolve));
        
        mockProcess.stdout.emit("data", Buffer.from("Progress: 25%\n"));
        mockProcess.stdout.emit("data", Buffer.from("Progress: 50%\n"));
        mockProcess.stdout.emit("data", Buffer.from("Progress: 100%\n"));
        mockProcess.emit("exit", 0);
        
        await resultPromise;
        
        expect(onProgress).toHaveBeenCalledWith("Progress: 25%");
        expect(onProgress).toHaveBeenCalledWith("Progress: 50%");
        expect(onProgress).toHaveBeenCalledWith("Progress: 100%");
        expect(onProgress).toHaveBeenCalledTimes(3);
    });
    
    it("should handle empty output gracefully", async () => {
        const resultPromise = goose.execute({ task: "Silent task" });
        
        await new Promise(resolve => setImmediate(resolve));
        
        mockProcess.emit("exit", 0);
        
        const result = await resultPromise;
        
        expect(result).toEqual({
            success: true,
            data: "",
        });
    });
    
    it("should handle multiline output", async () => {
        const resultPromise = goose.execute({ task: "Detailed task" });
        
        await new Promise(resolve => setImmediate(resolve));
        
        const output = `Starting browser...
Navigating to page...
Taking screenshot...
Analysis complete:
- Page loaded successfully
- All elements visible
- No errors detected`;
        
        mockProcess.stdout.emit("data", Buffer.from(output));
        mockProcess.emit("exit", 0);
        
        const result = await resultPromise;
        
        expect(result).toEqual({
            success: true,
            data: output,
        });
    });
});