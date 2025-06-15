# AgentDiscoveryCard Usage Example

To create an event that will be rendered as an agent discovery card, the event must have:

1. A `render-type` tag set to `"agent_discovery"`
2. Content in JSON format with an `agents` array

## Event Structure Example

```javascript
const event = new NDKEvent(ndk);
event.kind = 1; // Or any other kind you're using for status updates
event.content = JSON.stringify({
  agents: [
    {
      pubkey: "agent1pubkey...",
      name: "Code Review Agent",
      role: "Reviewer",
      description: "Specializes in code quality and security audits"
    },
    {
      pubkey: "agent2pubkey...", 
      name: "Documentation Agent",
      role: "Documenter",
      description: "Creates and maintains project documentation"
    }
  ]
});
event.tags = [
  ["render-type", "agent_discovery"],
  ["a", projectTagId], // Project reference
  // ... other tags as needed
];
```

## Visual Result

The card will display:
- A purple/blue gradient background
- "Found X specialized agents" header with sparkle icon
- Each agent listed with:
  - Avatar (from their profile or default bot icon)
  - Name and role badge
  - Description text
  - Arrow indicator
- Footer text explaining the agents' purpose

## When to Use

Use this card type when:
- An agent discovers other specialized agents that could help
- You want to announce new agents joining the project
- You need to showcase available agent capabilities