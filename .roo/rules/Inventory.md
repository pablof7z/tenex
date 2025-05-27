Maintain an accurate inventory of all code files, providing a concise one-line summary clearly stating each file's responsibility and scope. Immediately update this inventory whenever you create, significantly modify, or delete files.

**Inventory Guidelines for LLMs:**

- **Clearly state the file's purpose:** Each entry should explicitly describe what the file does, its main responsibility, and scope.
- **Avoid vagueness:** Entries must precisely communicate responsibilities and usage context to enable quick understanding by other LLMs without additional context.

# Code Inventory

```
components/ui/
├── audio-recorder.tsx  # Voice recording component with WebM recording, playback controls, and visual feedback for task creation
app/api/
├── transcribe/route.ts  # OpenAI Whisper integration API endpoint for converting audio to text with error handling and validation
lib/
├── text-corrections.ts  # Text processing utility for fixing common speech-to-text errors and applying nostr-specific corrections
├── parse-transcription.ts  # Intelligent text parsing utility for splitting transcriptions into meaningful title and description parts
config/
├── corrections.js  # Configuration file containing common transcription corrections and regex patterns for voice-to-text processing
hooks/
├── useTranscription.ts  # React hook for handling audio transcription with retry logic, error handling, and user feedback
types/
├── audio.ts  # TypeScript type definitions for audio recording, transcription responses, and related interfaces
```