import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Define the base directory where projects will be created
// TODO: Make this configurable?
const PROJECTS_BASE_DIR = path.resolve(process.cwd(), 'projects');

export async function POST(request: Request) {
    try {
        const { name, description } = await request.json();

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return NextResponse.json({ error: 'Project name is required and must be a non-empty string' }, { status: 400 });
        }
        if (typeof description !== 'string') {
            // Allow empty description, but ensure it's a string
            return NextResponse.json({ error: 'Project description must be a string' }, { status: 400 });
        }

        // Basic sanitization for directory name (replace spaces, avoid path traversal)
        const safeProjectName = name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/\.+/g, '.');
        if (!safeProjectName) {
             return NextResponse.json({ error: 'Invalid project name resulting in empty directory name' }, { status: 400 });
        }

        const projectDir = path.join(PROJECTS_BASE_DIR, safeProjectName);
        const contextDir = path.join(projectDir, 'context');
        const specFilePath = path.join(contextDir, 'SPEC.md');

        // Create projects base directory if it doesn't exist
        await fs.mkdir(PROJECTS_BASE_DIR, { recursive: true });

        // Check if project directory already exists to prevent overwriting
        try {
            await fs.access(projectDir);
            // If access doesn't throw, directory exists
            console.warn(`Project directory already exists: ${projectDir}`);
            // Decide on behavior: error out or allow? For now, let's log and continue,
            // assuming we might want to update the spec later via a different mechanism.
            // If strict creation is needed, uncomment the next line:
            // return NextResponse.json({ error: `Project directory '${safeProjectName}' already exists` }, { status: 409 });
        } catch (error: any) {
            // If access throws an error other than ENOENT, re-throw it
            if (error.code !== 'ENOENT') {
                throw error;
            }
            // ENOENT means directory doesn't exist, which is expected for creation
            await fs.mkdir(projectDir); // Create the project directory
        }


        // Create context directory (recursive handles if projectDir was just created or already existed)
        await fs.mkdir(contextDir, { recursive: true });

        // Write the spec file
        await fs.writeFile(specFilePath, description || ''); // Write empty string if description is null/undefined

        console.log(`Project directory and spec created at: ${projectDir}`);

        return NextResponse.json({ message: 'Project structure created successfully', path: projectDir }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating local project structure:', error);
        // Provide a more specific error message if possible
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: 'Failed to create local project structure', details: errorMessage }, { status: 500 });
    }
}