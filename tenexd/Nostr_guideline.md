# Comprehensive Technical Guide to Nostr for LLMs

## Table of Contents
1. [Core Protocol Concepts](#core-protocol-concepts)
2. [Cryptography and Encoding](#cryptography-and-encoding)
3. [Event Structure and Serialization](#event-structure-and-serialization)
4. [Event Kinds and Categories](#event-kinds-and-categories)
5. [Tags System](#tags-system)
6. [Client-Relay Communication](#client-relay-communication)
7. [Filters and Subscriptions](#filters-and-subscriptions)
8. [Important Technical Details](#important-technical-details)
9. [Common Pitfalls and Best Practices](#common-pitfalls-and-best-practices)

## Core Protocol Concepts

### Overview
Nostr (Notes and Other Stuff Transmitted by Relays) is a decentralized protocol based on cryptographic keys and signatures. The protocol defines:
- **Events**: The only object type in Nostr
- **Clients**: Software that creates, signs, and validates events
- **Relays**: Servers that store and transmit events

### Key Principles
1. Users are identified by public keys (not usernames)
2. Every event is cryptographically signed
3. Relays are "dumb" - they just store and forward events
4. Clients handle all intelligence and validation

## Cryptography and Encoding

### Key Pairs
- **Algorithm**: Schnorr signatures on secp256k1 curve
- **Private Key**: 32 bytes (256 bits)
- **Public Key**: 32 bytes (256 bits) - x-coordinate only

### Encoding Formats

#### Hex Encoding (Internal Use)
- **ALWAYS use hex encoding internally** for:
  - Event IDs
  - Public keys in events
  - Tags referencing other events/users
  - Filter parameters
- Format: 64 lowercase hexadecimal characters
- Example: `3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d`

#### Bech32 Encoding (User-Facing Only)
- **ONLY for display, input, and sharing** - NEVER in protocol messages
- Prefixes:
  - `npub`: Public keys
  - `nsec`: Private keys
  - `note`: Event IDs
  - `nprofile`: Profile with metadata (TLV format)
  - `nevent`: Event with metadata (TLV format)
  - `naddr`: Addressable event coordinates (TLV format)
  
**CRITICAL**: 
- `npub` ≠ public key, it's the bech32 encoding of the public key
- Filters CANNOT use bech32: `{"#e": ["nevent1..."]}` is INVALID
- Must use hex: `{"#e": ["5c83da77af1dec6d7289834998ad7aafbd9e2191396d75ec3cc27f5a77226f36"]}`

## Event Structure and Serialization

### Event Object Format
```json
{
    "id": "<32-bytes lowercase hex-encoded sha256>",
    "pubkey": "<32-bytes lowercase hex-encoded public key>",
    "created_at": <unix timestamp in seconds>,
    "kind": <integer 0-65535>,
    "tags": [
        ["<tag_name>", "<tag_value>", "<optional_additional_values>"],
        ...
    ],
    "content": "<arbitrary string>",
    "sig": "<64-bytes lowercase hex Schnorr signature>"
}
```

### Event ID Calculation
The event ID is the SHA256 hash of a specifically serialized array:

```json
[
    0,
    "<pubkey in lowercase hex>",
    <created_at as number>,
    <kind as number>,
    <tags as array>,
    "<content as string>"
]
```

**Serialization Rules**:
1. UTF-8 encoding
2. NO whitespace or line breaks
3. Minimal JSON (no extra spaces)
4. Escape in content field:
   - `\n` for line break (0x0A)
   - `\"` for double quote (0x22)
   - `\\` for backslash (0x5C)
   - `\r` for carriage return (0x0D)
   - `\t` for tab (0x09)
   - `\b` for backspace (0x08)
   - `\f` for form feed (0x0C)

## Event Kinds and Categories

### Kind Ranges and Behavior

#### Regular Events (Stored Normally)
- Range: `1000 <= n < 10000` OR `4 <= n < 45` OR `n == 1` OR `n == 2`
- Behavior: All events are stored and returned

#### Replaceable Events 
- Range: `10000 <= n < 20000` OR `n == 0` OR `n == 3`
- Behavior: Only latest event per `(pubkey, kind)` is kept
- Examples: 
  - Kind 0: User metadata
  - Kind 3: Contact list
  - Kind 10002: Relay list

#### Ephemeral Events
- Range: `20000 <= n < 30000`
- Behavior: Not stored by relays, only transmitted in real-time
- Use cases: Typing indicators, online status

#### Addressable Events (Parameterized Replaceable)
- Range: `30000 <= n < 40000`
- Behavior: Only latest event per `(pubkey, kind, d-tag)` is kept
- **REQUIRES** a `d` tag to identify which instance to replace
- Examples:
  - Kind 30023: Long-form content (articles)
  - Kind 30311: Live events
  - Kind 31922: Calendar date-based events

### Important Kind-Specific Details
- **Kind 0**: Content is stringified JSON with user metadata
- **Addressable events**: MUST have a `d` tag (even if empty string for single instance)
- **Regular replaceable**: Do NOT use `d` tag

## Tags System

### Standard Tags

#### Core Protocol Tags
- **`e` tag**: Reference to an event
  ```json
  ["e", "<event_id_hex>", "<relay_url_optional>", "<author_pubkey_hex_optional>"]
  ```
  
- **`p` tag**: Reference to a user/pubkey
  ```json
  ["p", "<pubkey_hex>", "<relay_url_optional>"]
  ```
  
- **`a` tag**: Reference to addressable event
  ```json
  ["a", "<kind>:<author_pubkey_hex>:<d_tag_value>", "<relay_url_optional>"]
  ```
  Note: For replaceable (non-addressable) events, use empty d_tag_value but keep the colon

- **`d` tag**: Identifier for addressable events
  ```json
  ["d", "<unique_identifier>"]
  ```

### Tag Indexing Rules
- **Single-letter tags** (a-z, A-Z) are indexed by relays
- Only the **first value** of each tag is indexed
- Querying uses `#` prefix: `{"#e": ["event_id_hex"]}`
- Tags are matched using "contains" logic for array values

## Client-Relay Communication

### WebSocket Messages

#### Client to Relay
1. **EVENT**: Publish an event
   ```json
   ["EVENT", <event_object>]
   ```

2. **REQ**: Request events and subscribe
   ```json
   ["REQ", "<subscription_id>", <filter1>, <filter2>, ...]
   ```
   - `subscription_id`: Max 64 chars, unique per connection
   - Multiple filters = OR operation

3. **CLOSE**: End subscription
   ```json
   ["CLOSE", "<subscription_id>"]
   ```

#### Relay to Client
1. **EVENT**: Send requested event
   ```json
   ["EVENT", "<subscription_id>", <event_object>]
   ```

2. **OK**: Acknowledge EVENT submission
   ```json
   ["OK", "<event_id>", <boolean>, "<message>"]
   ```
   - true = accepted, false = rejected
   - Message format: `"prefix: human readable"`

3. **EOSE**: End of stored events
   ```json
   ["EOSE", "<subscription_id>"]
   ```
   - Marks transition to real-time events

4. **CLOSED**: Subscription terminated
   ```json
   ["CLOSED", "<subscription_id>", "<reason>"]
   ```

5. **NOTICE**: Human-readable message
   ```json
   ["NOTICE", "<message>"]
   ```

## Filters and Subscriptions

### Filter Object Structure
```json
{
    "ids": ["<event_id_hex>", ...],
    "authors": ["<pubkey_hex>", ...],
    "kinds": [<kind_number>, ...],
    "#<tag_name>": ["<tag_value>", ...],
    "since": <unix_timestamp>,
    "until": <unix_timestamp>,
    "limit": <number>
}
```

### Filter Matching Rules
1. **Array fields**: Event matches if ANY array element matches
2. **Multiple conditions**: ALL conditions must match (AND)
3. **Multiple filters**: Event matches if ANY filter matches (OR)
4. **Tag filters**: `#e`, `#p`, etc. match if event has tag with value
5. **Hex values**: Must be exact 64-char lowercase hex
6. **Time range**: `since <= created_at <= until`
7. **Limit**: Only applies to initial query, ignored for real-time

### Important Filter Details
- Empty array `[]` in filter typically matches nothing
- Missing field matches everything for that field
- Tag filters only check first value of each tag
- Prefixes supported for `ids` and `authors`

## Important Technical Details

### Event Validation
1. Verify event ID matches SHA256 of serialized data
2. Verify signature with author's public key
3. Check timestamp is reasonable (not too far future)
4. Validate all referenced hex strings are proper format

### Relay Behavior for Event Types
- **Regular**: Store all valid events
- **Replaceable**: Delete older events with same `(pubkey, kind)`
- **Addressable**: Delete older events with same `(pubkey, kind, d-tag)`
- **Ephemeral**: Transmit but don't store

### Timestamp Handling
- Use Unix timestamp in seconds (not milliseconds)
- For same timestamp replaceable events: keep lowest ID (lexical order)
- Relays may reject events with unreasonable timestamps

## Common Pitfalls and Best Practices

### Critical Mistakes to Avoid
1. **NEVER** use bech32 encoding in:
   - Event objects
   - Filter parameters  
   - NIP-05 responses
   - Any protocol-level communication

2. **NEVER** query with bech32:
   ```json
   // WRONG:
   {"#e": ["nevent1qqsr4dhp6ftdcynrwfd5gfxc66246m6gry89dmwhx3xyj0td8wjfumspz3mhxue69uhhyetvv9ujuerpd46hxtnfduqs6amnwvaz7tmwdaejumr0dsq3camnwvaz7tmjv4kxz7fwd46hg6tw09mkzmrvv46zucm0d5yx7eqe"]}
   
   // CORRECT:
   {"#e": ["5c83da77af1dec6d7289834998ad7aafbd9e2191396d75ec3cc27f5a77226f36"]}
   ```

3. **ALWAYS** use hex encoding internally
4. **ALWAYS** include `d` tag for addressable events (30000-39999)
5. **NEVER** use `d` tag for regular replaceable events

### Best Practices
1. Store keys in hex or binary format internally
2. Convert to bech32 only for user display/input
3. Validate event IDs and signatures before storing
4. Use proper UTF-8 JSON serialization for ID calculation
5. Index single-letter tags for efficient querying
6. Handle replaceable events by checking timestamps and IDs
7. Support multiple relay connections per client
8. Properly escape special characters in content field

### Query Optimization
1. Use specific filters to reduce data transfer
2. Combine related queries in single REQ with multiple filters
3. Use `limit` to prevent overwhelming clients
4. Close unused subscriptions to free resources
5. Use `since`/`until` for time-based queries

## Additional Context for LLMs

When working with Nostr:
1. Think of events as immutable messages that flow through relays
2. Users control their identity through private keys
3. Relays are interchangeable and users typically use multiple
4. There's no central authority - consensus comes from client behavior
5. The protocol is extensible through new event kinds and tags
6. Bech32 is ONLY a human-friendly representation layer
7. All internal processing should use hex encoding
8. Event IDs are deterministic based on content
9. Signatures prove authorship but relays don't verify content
10. Addressable events enable mutable content through replacement
