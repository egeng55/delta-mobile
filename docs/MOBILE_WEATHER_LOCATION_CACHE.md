# Mobile Weather And Location Cache

Last reviewed: 2026-06-23.

This document inventories mobile weather/location persistence and the Phase 133
cache hardening. It should not include provider tokens, raw coordinates from a
device, or cached payload values from a real user.

## Summary

The only persistent weather/location cache found in `src/` is
`@delta_weather_cache` in `src/services/weather.ts`. The app requests foreground
location, fetches OpenWeatherMap current weather and air quality, then stores a
short-lived weather display payload. The app does not persist a location
history and the current `WeatherData` payload does not intentionally store
latitude or longitude.

Phase 133 keeps this cache in `AsyncStorage` because it is a high-volume,
short-lived display cache, not a small preference suited for `SecureStore`.
The cache now uses `src/services/storage/weatherLocationCache.ts`, which adds a
schema-versioned TTL envelope, malformed/expired cleanup, legacy cache
handling, token-like field stripping, and coordinate rounding if coordinates
are accidentally included.

## Storage Inventory

| Location | Key | Payload | Classification | Implementation status |
| --- | --- | --- | --- | --- |
| `src/services/weather.ts` | `@delta_weather_cache` | current weather, city-level `location`, weather conditions, air quality, timestamps | `ttl_needed`, `minimization_needed`, `precision_reduction_needed` | Phase 133 complete |

## Payload Fields

The intended cached payload is `WeatherData`:

- temperature and feels-like values in Fahrenheit/Celsius
- humidity
- weather description and icon
- estimated UV index
- optional air quality label and particulate values
- wind speed and visibility
- sunrise/sunset display strings
- city-level location name from the provider
- weather timestamp

The payload should not include:

- provider API keys, tokens, app ids, authorization headers, credentials,
  secrets, or passwords
- precise latitude/longitude
- long-term location history
- raw provider responses
- free-text user content

## Current Retention

The weather cache TTL remains 30 minutes. Expired cache entries are removed
when read. Malformed entries are also removed when read. Legacy cache entries
using the old `{ data, timestamp }` shape are read if still fresh, sanitized,
and rewritten into the current envelope.

## Precision And Minimization

The current production payload does not intentionally store coordinates. If a
future or legacy payload contains coordinate fields named `lat`, `lon`,
`latitude`, or `longitude`, the weather cache helper rounds numeric values to
two decimal places before returning or storing them. That is a defensive
minimization step, not a new location feature.

Token-like fields are recursively removed from objects and arrays before
storage. Display fields such as city, temperature, conditions, air quality, and
timestamps are preserved.

## Handling Classification

| Storage location | Handling |
| --- | --- |
| `@delta_weather_cache` | `ttl_needed`, `minimization_needed`, `precision_reduction_needed` |
| Foreground permission state | `safe_no_change_needed`; managed by Expo location permission APIs, not cached here |
| Provider API key | `safe_no_change_needed`; read from Expo config, not stored in the cache |
| Location history | `safe_no_change_needed`; no persistent location history was found |
| Broader location strategy | `defer_broad_location_strategy`; do not expand location persistence without explicit approval |

## Verification

Phase 133 adds `src/services/storage/weatherLocationCache.test.ts` covering:

- valid cache read
- expired cache cleanup
- malformed cache cleanup
- token-like field stripping
- coordinate precision reduction
- legacy cache read and rewrite
- preservation of display fields
