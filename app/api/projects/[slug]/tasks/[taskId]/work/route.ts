import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getProjectPath } from '@/lib/projectUtils'; // Assuming this utility exists and works

// Get the base path from environment variable for security check
const PROJECTS_PATH = process.env.PROJECTS_PATH;

if (!PROJECTS_PATH) {
   console.error("FATAL: PROJECTS_PATH environment variable is not set.");
   // We'll handle this more gracefully within the request if needed
}

interface RequestBody {
    title?: string;
    description?: string;
    context?: string[]; // Array of strings for additional context
    clinePrompt?: string; // Optional override for the Cline prompt
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; taskId: string } } // Changed id to slug
) {
  const projectSlug = params.slug; // Changed projectId to projectSlug
  const taskId = params.taskId;

  if (!projectSlug || !taskId) {
    return NextResponse.json({ error: 'Project slug and Task ID are required' }, { status: 400 }); // Updated error message
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title = 'Untitled Task', description = '', context = [], clinePrompt: customClinePrompt } = body;

  let projectDirPath: string;
  try {
    projectDirPath = getProjectPath(projectSlug); // Use projectSlug
  } catch (error: unknown) { // Changed any to unknown
    const message = error instanceof Error ? error.message : 'Unknown error getting project path';
    console.error(`Error getting project path for slug ${projectSlug}: ${message}`); // Use projectSlug
    if (message.includes("PROJECTS_PATH")) {
        return NextResponse.json({ error: 'Server configuration error: PROJECTS_PATH not set.' }, { status: 500 });
    }
    return NextResponse.json({ error: `Failed to determine project path: ${message}` }, { status: 400 });
  }

  console.log(`Received request to start work on task ${taskId} for project ${projectSlug} at path: ${projectDirPath}`); // Use projectSlug

  // --- Security Check ---
  if (!PROJECTS_PATH) {
       console.error("FATAL: PROJECTS_PATH environment variable is not set for security check.");
       return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const allowedBaseDir = path.resolve(PROJECTS_PATH);
  if (!path.resolve(projectDirPath).startsWith(allowedBaseDir)) {
      console.error(`Security Error: Attempted path traversal: ${projectDirPath} is outside ${allowedBaseDir}`);
      return NextResponse.json({ error: 'Invalid project path' }, { status: 400 });
  }
  // --- End Security Check ---


  // --- Prepare Task File ---
  const taskFileName = `${taskId}.md`;
  const tempTasksDir = path.join(projectDirPath, 'temp', 'tasks');
  const taskFilePath = path.join(tempTasksDir, taskFileName);

  let fileContent = `Work on the following:\n`;
  fileContent += `Task ID: ${taskId}\n`;
  fileContent += `Title: ${title}\n\n`;
  fileContent += `${description}\n\n`;
  fileContent += `As you work on this, publish updates to nostr including the task ID you are working on.\n`;

  if (context.length > 0) {
    fileContent += `\n---------\n\n`;
    fileContent += `Here is some more context that might be useful:\n`;
    context.forEach(item => {
      fileContent += `- ${item}\n`;
    });
  }

  try {
    // Ensure the temp/tasks directory exists
    fs.mkdirSync(tempTasksDir, { recursive: true });
    // Write the task file
    fs.writeFileSync(taskFilePath, fileContent);
    console.log(`Task file created: ${taskFilePath}`);
  } catch (error: unknown) { // Changed any to unknown
    const message = error instanceof Error ? error.message : 'Unknown error creating task file';
    console.error(`Error creating task file ${taskFilePath}: ${message}`);
    return NextResponse.json({ error: `Failed to create task file: ${message}` }, { status: 500 });
  }
  // --- End Prepare Task File ---


  // --- Execute open-editor Script ---
  const scriptPath = path.resolve(process.cwd(), 'scripts/open-editor');

  // Check if the script exists and is executable
  try {
    fs.accessSync(scriptPath, fs.constants.X_OK);
  } catch (err) {
    console.error(`Error: Script not found or not executable: ${scriptPath}`, err);
    // Note: We created the task file, but can't open the editor.
    // Consider if this should be a 500 or maybe return success with a warning.
    return NextResponse.json({ error: 'Task file created, but failed to execute open-editor script (not found or permissions)' }, { status: 500 });
  }

  // Construct the Cline prompt
  const relativeTaskPath = path.relative(projectDirPath, taskFilePath); // Get path relative to project root
  const finalClinePrompt = customClinePrompt || `Follow instructions in ${relativeTaskPath}.`;

  // Execute the script asynchronously
  exec(`"${scriptPath}" "${projectDirPath}" "${finalClinePrompt}"`, (error, stdout, stderr) => {
    if (error) {
      // Log errors, but don't block the response as the main action (file creation) succeeded.
      console.error(`Error executing open-editor script for ${projectDirPath} with prompt "${finalClinePrompt}": ${error.message}`);
      console.error(`stderr: ${stderr}`);
    }
    if (stdout) console.log(`open-editor stdout: ${stdout}`);
    if (stderr) console.warn(`open-editor stderr: ${stderr}`);
  });
  // --- End Execute open-editor Script ---

  // Respond immediately
  return NextResponse.json({
      message: `Request received to start work on task ${taskId} for project ${projectSlug}. Task file created at ${relativeTaskPath}.`, // Use projectSlug
      taskFilePath: relativeTaskPath // Send back the relative path
  }, { status: 202 }); // 202 Accepted
}