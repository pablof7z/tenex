# TENEX CLI Manual Testing Instructions

This guide describes how to manually test the TENEX CLI tool and verify that Nostr status updates are published for each command.

---

## 1. Test `tenex setup` and Config Wizard

### a. Fresh Initialization (Create New Key)
1. Delete any existing TENEX config (`~/.tenex/config`).
2. Run: `tenex setup`
3. Choose "Create new key" in the wizard.
4. Enter a profile name.
5. Confirm that:
   - A new nsec is generated and config is saved.
   - An avatar URL is shown.
   - "Profile published to Nostr." and "Configuration saved..." messages appear.
   - A Nostr status update is published: "TENEX CLI initialized." (kind 1).

### b. Login with Existing Key
1. Delete any existing TENEX config.
2. Run: `tenex setup`
3. Choose "Login with existing key".
4. Enter a valid nsec key.
5. Confirm that:
   - "nsec validated." and "Configuration saved..." messages appear.
   - A Nostr status update is published: "TENEX CLI initialized." (kind 1).

---

## 2. Test `tenex agent publish`

### a. Minimal Parameters
1. Run: `tenex agent publish --title "Test Agent"`
2. Confirm that:
   - "Starting agent publish..." Nostr status update is published.
   - "Agent published to Nostr." message appears.
   - "Agent published to Nostr." Nostr status update is published.

### b. All Parameters
1. Run: 
   ```
   tenex agent publish --title "Full Agent" --avatar "https://example.com/avatar.png" --description "Desc" --role "Role" --instructions "Do X" --models "gpt-4" --file ./somefile.txt
   ```
2. Confirm as above, and that file count is included in the Nostr update context.

### c. Failure Case
1. Simulate a failure (e.g., disconnect network).
2. Run: `tenex agent publish --title "Fail Agent"`
3. Confirm that a "Failed to publish agent." Nostr status update is published.

---

## 3. Test `tenex agent find` and `tenex agent install`

1. Run: `tenex agent find`
2. Confirm that:
   - "The 'agent find' feature is coming soon." is shown.
   - A Nostr status update is published: "User ran 'agent find' (feature coming soon)."

3. Run: `tenex agent install`
4. Confirm that:
   - "The 'agent install' feature is coming soon." is shown.
   - A Nostr status update is published: "User ran 'agent install' (feature coming soon)."

---

## 4. Nostr Update Verification

- Use a Nostr client or relay to monitor published events from your pubkey.
- Confirm that all status updates (kind 1) are published as described above, with appropriate tags/context.

---

## Notes

- If you encounter errors about missing modules, run:
  ```
  bun install
  ```
- The project uses Bun as its runtime, not Node.js