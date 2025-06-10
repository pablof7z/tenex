# Changelog

## [0.5.0] - 2025-01-06

### Added
- **Agent Management System**: MCP server now supports multiple agent identities
  - Added mandatory `agent_name` parameter to `publish_task_status_update` tool
  - Added `--config-file` parameter to specify path to `.tenex/agents.json`
  - Agents are created dynamically when first used
  - Each agent publishes its own kind:0 profile event (e.g., "code @ ProjectName")
  - Proper nsec encoding for all agent private keys

### Changed
- **Breaking**: Replaced `nostr.json` with `agents.json` format
  - Old format: `{"nsec": "...", "pubkey": "..."}`
  - New format: `{"default": "nsec...", "agent-name": "nsec..."}`
- Config initialization is now async to support file operations
- Private keys are now properly encoded as nsec format (was hex in some cases)

### Deprecated
- `--nsec` parameter is deprecated in favor of `--config-file`
- Direct NSEC environment variable usage (use config file instead)

### Fixed
- Fixed private key encoding to always use nsec format
- Fixed variable naming conflict in publish logic

## [0.4.1] - Previous version
- (Previous changes...)