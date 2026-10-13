# Definition of Done

A stage or feature is complete only when all applicable checks are satisfied.

## Functionality
- Acceptance criteria are met.
- Input validation and error states are implemented.
- Authorization is enforced server-side.
- Tenant ownership is checked for every referenced resource.

## Quality
- Tests cover success, validation failure, permission denial, and relevant edge cases.
- Lint and typecheck pass.
- API documentation is updated.
- Migrations are reviewed and safe for the intended environment.

## Security and privacy
- No secrets in Git or logs.
- No public selfie storage.
- Sensitive data exposure is minimized.
- Audit events exist for required privileged operations.
- Cross-tenant tests pass.

## Delivery
- Changes remain within the assigned stage.
- README/run instructions are updated where necessary.
- Session report is provided.
- Agent stops and waits for the next instruction.
