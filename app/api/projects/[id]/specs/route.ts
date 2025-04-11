import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getProjectContextPath } from '@/lib/projectUtils'; // Import the new utility function

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    // Use the utility function to get the project's context directory path
    const projectContextDir = getProjectContextPath(projectId);

    console.log(`Attempting to read spec files from: ${projectContextDir}`);

    let fileNames: string[];
    try {
      fileNames = await fs.readdir(projectContextDir);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log(`Context directory not found for project ${projectId}, creating: ${projectContextDir}`);
        // Create the directory if it doesn't exist
        await fs.mkdir(projectContextDir, { recursive: true });
        console.log(`Context directory created: ${projectContextDir}`);
        // Return empty files array as the directory was just created
        return NextResponse.json({ files: [] });
      }
      // Other errors during readdir should be reported
      console.error(`Error reading context directory ${projectContextDir}:`, err);
      throw new Error(`Failed to read context directory: ${err.message}`);
    }

    if (fileNames.length === 0) {
        console.log(`No files found in context directory: ${projectContextDir}`);
        return NextResponse.json({ files: [] });
    }

    const specFiles = await Promise.all(
      fileNames
        .filter(fileName => !fileName.startsWith('.')) // Ignore hidden files
        .map(async (fileName) => {
          const filePath = path.join(projectContextDir, fileName);
          try {
            const stats = await fs.stat(filePath);
            // Ensure it's a file, not a directory
            if (stats.isFile()) {
                const content = await fs.readFile(filePath, 'utf-8');
                return { name: fileName, content };
            }
            console.log(`Skipping directory: ${fileName}`);
            return null; // Skip directories
          } catch (readErr: any) {
            console.error(`Error reading file ${filePath}:`, readErr);
            // Optionally skip files that can't be read, or throw an error
            return null; // Skip file on error
          }
        })
    );

    // Filter out null values (skipped directories or files with read errors)
    const validSpecFiles = specFiles.filter(file => file !== null);

    console.log(`Successfully read ${validSpecFiles.length} spec files for project ${projectId}.`);
    return NextResponse.json({ files: validSpecFiles });

  } catch (error: any) {
    console.error(`Failed to get project specs for ${projectId}:`, error);
    return NextResponse.json({ error: error.message || 'Failed to get project specs' }, { status: 500 });
  }
}


export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    const { content } = await request.json();

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Spec content must be a string' }, { status: 400 });
    }

    // Use the utility function to get the project's context directory path
    const projectContextDir = getProjectContextPath(projectId);
    const specFilePath = path.join(projectContextDir, 'SPEC.md');

    console.log(`Attempting to write spec file to: ${specFilePath}`);

    // Ensure the context directory exists, creating it if necessary
    await fs.mkdir(projectContextDir, { recursive: true });
    console.log(`Ensured context directory exists: ${projectContextDir}`);

    // Write the new content to the SPEC.md file
    await fs.writeFile(specFilePath, content);

    console.log(`Successfully updated spec file: ${specFilePath}`);
    return NextResponse.json({ message: 'Spec updated successfully' });

  } catch (error: any) {
    console.error(`Failed to update project spec for ${projectId}:`, error);
    // Handle JSON parsing errors specifically
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update project spec' }, { status: 500 });
  }
}