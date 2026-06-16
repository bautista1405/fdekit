# @fdekit/environment-floci

## 0.4.0

### Patch Changes

- @fdekit/core@0.4.0

## 0.3.0

### Patch Changes

- 0cb6f4a: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
  - @fdekit/core@0.3.0

## 0.2.0

### Patch Changes

- 16dc2da: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
  - @fdekit/core@0.2.0
