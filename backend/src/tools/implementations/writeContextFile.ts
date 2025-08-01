import { mkdir, writeFile, access } from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import type { Tool } from "../types";
import { createZodSchema } from "../types";
import { NDKArticle } from "@nostr-dev-kit/ndk";
import { getNDK } from "@/nostr";
import { logger } from "@/utils/logger";
import { getProjectContext } from "@/services";

const WriteContextFileArgsSchema = z.object({
    filename: z.string().min(1, "filename must be a non-empty string"),
    content: z.string().min(1, "content must be a non-empty string"),
    title: z.string().min(1, "title must be a non-empty string"),
});

interface WriteContextFileInput {
    filename: string;
    content: string;
    title: string;
}

interface WriteContextFileOutput {
    message: string;
}

export const writeContextFileTool: Tool<WriteContextFileInput, WriteContextFileOutput> = {
    name: "write_context_file",
    description:
        "Write or update a specification file in the context/ directory. You must have read this file recently before writing to it.",

    parameters: createZodSchema(WriteContextFileArgsSchema),

    execute: async (input, context) => {
        logger.debug("write_context_file called", { input });

        const { filename, content, title } = input.value;

        // TODO: Implement agent role check when available in context
        // Only project-manager should use this tool

        // Validate filename - no path traversal allowed
        if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
            return {
                ok: false,
                error: {
                    kind: "validation" as const,
                    field: "filename",
                    message: "Invalid filename. Must not contain path separators or '..'",
                },
            };
        }

        // Only allow markdown files
        if (!filename.endsWith(".md")) {
            return {
                ok: false,
                error: {
                    kind: "validation" as const,
                    field: "filename",
                    message: "Only markdown files (.md) can be written to the context directory",
                },
            };
        }

        try {
            // Construct the full path
            const contextDir = path.join(context.projectPath, "context");
            const fullPath = path.join(contextDir, filename);

            // Check if this file was recently read from persisted conversation metadata
            const conversation = context.conversationManager.getConversation(
                context.conversationId
            );
            const readFiles = conversation?.metadata?.readFiles || [];
            const contextPath = `context/${filename}`;
            const wasRecentlyRead = readFiles.includes(contextPath);

            // Check if file exists
            let fileExists = false;
            try {
                await access(fullPath);
                fileExists = true;
            } catch {
                // File doesn't exist, allow creation
                fileExists = false;
            }

            // If file exists and wasn't recently read, deny access
            if (fileExists && !wasRecentlyRead) {
                return {
                    ok: false,
                    error: {
                        kind: "validation" as const,
                        field: "filename",
                        message: `You must read the file 'context/${filename}' before writing to it. Use the read_path tool first.`,
                    },
                };
            }

            // Ensure context directory exists
            await mkdir(contextDir, { recursive: true });

            // Write the file
            await writeFile(fullPath, content, "utf-8");

            // Publish NDKArticle for this context file update
            try {
                const article = new NDKArticle(getNDK());

                // Use the filename without .md extension as the dTag
                const dTag = filename.replace(/\.md$/, "");
                article.dTag = dTag;

                // Set article properties
                article.title = title;
                article.content = content;
                article.published_at = Math.floor(Date.now() / 1000);

                // Tag the article with the project
                const projectCtx = getProjectContext();
                article.tag(projectCtx.project);

                // Sign with the agent's signer
                await article.sign(context.agent.signer);
                await article.publish();

                logger.debug("Published NDKArticle for context file", { filename, dTag });
            } catch (error) {
                // Log error but don't fail the tool execution
                logger.error("Failed to publish NDKArticle", {
                    error: error instanceof Error ? error.message : String(error),
                });
            }

            return {
                ok: true,
                value: {
                    message: `Successfully wrote to context/${filename}`,
                },
            };
        } catch (error) {
            return {
                ok: false,
                error: {
                    kind: "execution" as const,
                    tool: "write_context_file",
                    message: `Failed to write file: ${error instanceof Error ? error.message : "Unknown error"}`,
                },
            };
        }
    },
};
