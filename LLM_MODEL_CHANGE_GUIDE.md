# LLM Model Change Feature Guide

## How to Change an Agent's LLM Model

### Prerequisites
1. Make sure your project has multiple LLM configurations in `.tenex/llms.json`
2. Ensure `tenex run` is running for your project (it publishes available models)
3. Be in a thread conversation with agents participating

### Steps to Change Model

1. **Open a Thread**
   - Navigate to a project in the web UI
   - Start or open an existing thread conversation

2. **Find the Model Change UI**
   - Look at the thread header (top of the conversation)
   - You'll see participant avatars on the right side
   - **Hover over an agent's avatar** to see their hover card

3. **In the Hover Card**
   - You'll see the agent's name and description
   - Current LLM model is shown with a CPU icon badge
   - Click the "Change Model" button

4. **Select New Model**
   - A dialog opens showing available models
   - The current model is marked
   - Click on a different model to select it
   - Click "Change Model" to confirm

5. **Verification**
   - The dialog will show success
   - Future messages from that agent will use the new model
   - The model tag will be visible in the agent's responses

### Troubleshooting

**Can't see participant avatars?**
- Make sure you're in thread mode (not the main chat)
- Ensure agents have participated in the conversation

**No hover card appears?**
- Try hovering directly over the avatar
- Check if the participant is an agent (has kind 4199 profile)

**No "Change Model" button?**
- Verify the agent has sent at least one message (so we know their current model)
- Check that `tenex run` is publishing LLM configurations

**No models available?**
- Ensure `.tenex/llms.json` has multiple configurations
- Check that `tenex run` is running and publishing status events
- Look in browser console for any errors

### Technical Details

- Only project owners can change agent models
- Changes are sent as kind 24101 events
- The CLI listens for these events and updates the agent's configuration
- Changes apply to new messages only (existing messages keep their original model info)