# Changelog

## V1.5.0

### Added

- Much more reliable heartbeat mechanism using `lastPong` timestamp + separate timeout window
- IP address logging on first system registration
- `lastDisconnectReason` field in system metadata for better debugging
- Stronger username validation (3–64 characters, proper trimming)
- Protection against race conditions during username takeover
- Dedicated `cleanupClient()` helper for consistent disconnect handling
- Logging of anonymous connection closures
- More consistent & grep-friendly log format

### Changed

- Switched from plain object → `Map` for both `clients` and `systems` (better semantics & iteration)
- Heartbeat timeout is now 50 seconds (was implicit before)
- `systems.json` now loads with `active: false` by default on server restart
- `saveSystems()` is now non-blocking (errors are caught & logged)
- Improved message parsing safety
- Better separation of concerns & code organization

### Fixed

- Zombie connections staying in `clients` Map after timeout/close
- Potential concurrent connection takeover issues
- Inconsistent `lastSeen` updates
- Missing error handling in several critical paths

### Removed

- Old brittle `isAlive` only heartbeat pattern (replaced with timestamp-based)

