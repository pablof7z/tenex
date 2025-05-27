import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        // Check if OpenAI API key is configured
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured' },
                { status: 500 }
            );
        }

        // Get the form data
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            );
        }

        // Validate file size (25MB limit)
        const maxSize = 25 * 1024 * 1024; // 25MB in bytes
        if (audioFile.size > maxSize) {
            return NextResponse.json(
                { error: 'Audio file too large. Maximum size is 25MB.' },
                { status: 400 }
            );
        }

        // Validate file type - handle WebM with codecs parameter
        const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
        const audioType = audioFile.type.split(';')[0]; // Remove codec info for comparison
        
        if (!allowedTypes.includes(audioType)) {
            console.log('Received audio type:', audioFile.type, 'Base type:', audioType);
            return NextResponse.json(
                { error: `Invalid audio file type: ${audioFile.type}. Supported formats: WebM, MP4, MP3, WAV, OGG` },
                { status: 400 }
            );
        }

        console.log(`Processing audio file: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);

        // Convert File to Buffer for OpenAI API
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Create a File-like object for OpenAI API
        const fileForOpenAI = new File([buffer], audioFile.name || 'audio.webm', {
            type: audioFile.type,
        });

        // Transcribe with OpenAI Whisper
        console.log('Sending to OpenAI Whisper API...');
        const transcription = await openai.audio.transcriptions.create({
            file: fileForOpenAI,
            model: 'whisper-1',
            language: 'en', // Can be made configurable
            response_format: 'text',
            temperature: 0.2, // Lower temperature for more consistent results
        });

        console.log('Transcription received:', transcription);

        if (!transcription || typeof transcription !== 'string') {
            return NextResponse.json(
                { error: 'Failed to transcribe audio' },
                { status: 500 }
            );
        }

        // Apply text corrections
        const { applyTextCorrections } = await import('@/lib/text-corrections');
        const correctedText = applyTextCorrections(transcription);

        // Parse into title and description
        const { parseTranscription } = await import('@/lib/parse-transcription');
        const { title, description } = parseTranscription(correctedText);

        console.log('Parsed result:', { title, description });

        return NextResponse.json({
            success: true,
            transcription: correctedText,
            title,
            description,
            originalText: transcription,
        });

    } catch (error) {
        console.error('Transcription error:', error);
        
        // Handle specific OpenAI errors
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                return NextResponse.json(
                    { error: 'Invalid OpenAI API key' },
                    { status: 401 }
                );
            }
            
            if (error.message.includes('quota')) {
                return NextResponse.json(
                    { error: 'OpenAI API quota exceeded' },
                    { status: 429 }
                );
            }

            if (error.message.includes('rate limit')) {
                return NextResponse.json(
                    { error: 'Rate limit exceeded. Please try again later.' },
                    { status: 429 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Failed to process audio transcription' },
            { status: 500 }
        );
    }
}

// Handle unsupported methods
export async function GET() {
    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
    );
}

export async function PUT() {
    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
    );
}

export async function DELETE() {
    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
    );
}