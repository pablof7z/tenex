import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getProjectPath } from '@/lib/projectUtils'; // Import the utility function

// Get the base path from environment variable for security check
const PROJECTS_PATH = process.env.PROJECTS_PATH;

if (!PROJECTS_PATH) {
   console.error("FATAL: PROJECTS_PATH environment variable is not set.");
   // Optionally, you could return a 500 error here immediately,
   // but the getProjectPath function will also throw if called without PROJECTS_PATH being set.
   // Depending on desired behavior, handle this early or let getProjectPath handle it.
}


export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  let projectDirPath: string;
  try {
    // Use the utility function to get the project path
    projectDirPath = getProjectPath(projectId);
  } catch (error: any) {
    console.error(`Error getting project path for ID ${projectId}: ${error.message}`);
    // If PROJECTS_PATH wasn't set, this might be the error source
    if (error.message.includes("PROJECTS_PATH")) {
        return NextResponse.json({ error: 'Server configuration error: PROJECTS_PATH not set.' }, { status: 500 });
    }
    // Handle other errors from getProjectPath (e.g., empty projectId, though checked above)
    return NextResponse.json({ error: `Failed to determine project path: ${error.message}` }, { status: 400 });
  }

  console.log(`Attempting to open editor for project ${projectId} at path: ${projectDirPath}`);

  // Security Check: Ensure the path is within the allowed base directory
  // Use the PROJECTS_PATH from environment variable for the check
  if (!PROJECTS_PATH) {
      // This check should ideally not be needed if the initial check passed,
      // but added for extra safety.
       console.error("FATAL: PROJECTS_PATH environment variable is not set for security check.");
       return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const allowedBaseDir = path.resolve(PROJECTS_PATH);
  if (!path.resolve(projectDirPath).startsWith(allowedBaseDir)) {
      console.error(`Security Error: Attempted path traversal: ${projectDirPath} is outside ${allowedBaseDir}`);
      return NextResponse.json({ error: 'Invalid project path' }, { status: 400 });
  }


  // Check if the directory exists before trying to open
  if (!fs.existsSync(projectDirPath) || !fs.lstatSync(projectDirPath).isDirectory()) {
    console.error(`Error: Project directory not found or is not a directory: ${projectDirPath}`);
    return NextResponse.json({ error: `Project directory not found: ${projectDirPath}` }, { status: 404 });
  }

  const scriptPath = path.resolve(process.cwd(), 'scripts/open-editor');

  // Check if the script exists and is executable (basic check)
  try {
    fs.accessSync(scriptPath, fs.constants.X_OK);
  } catch (err) {
    console.error(`Error: Script not found or not executable: ${scriptPath}`, err);
    return NextResponse.json({ error: 'Failed to execute open-editor script (not found or permissions)' }, { status: 500 });
  }

  // Execute the script
  // Use exec because we want to run an external command.
  // Ensure proper escaping/quoting if projectDirPath could contain special characters,
  // though path.resolve should handle basic cases. Using an array avoids shell interpretation issues.
  exec(`"${scriptPath}" "${projectDirPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing open-editor script for ${projectDirPath}: ${error.message}`);
      console.error(`stderr: ${stderr}`);
      // Don't return yet, let the client know the request was received.
      // The script itself provides feedback via stdout/stderr.
      // We might want to signal failure differently if needed.
    }
    console.log(`stdout: ${stdout}`);
    if (stderr) {
        console.warn(`stderr: ${stderr}`); // Log stderr as warning as the script might output info there too
    }
  });

  // Respond immediately to the client, the script runs asynchronously
  return NextResponse.json({ message: `Request received to open editor for project: ${projectId}` }, { status: 202 }); // 202 Accepted
}