# Task Entity Reference Example

When agents create tasks using the `add_task` tool, they should include a reference to the created task in their response message so it appears as a card in the chat view.

## Example Usage

When an agent creates a task, they should:

1. First create the task using the `add_task` tool
2. Then include a nostr entity reference in their response

### Example Agent Response:

```
I've created a new task for implementing the user authentication system:

nostr:nevent1qqsrq5h6ym7u9j5ew0xz8p4j5xg5xj5xg5xj5xg5xj5xg5xj5xg5xj5

This task has been assigned complexity level 7/10 due to the security considerations involved.
```

The nostr:nevent1... reference will automatically be rendered as a TaskCard component in the chat interface, showing:
- Task title
- Task description preview
- Complexity level
- Creation date

## Implementation Note

The current implementation of the `add_task` tool doesn't return the created event ID, so agents would need to be modified to:
1. Capture the published event ID after task creation
2. Encode it as a nevent using nip19
3. Include it in their response message

This would require updating the addTask tool to return the event ID in its success response.