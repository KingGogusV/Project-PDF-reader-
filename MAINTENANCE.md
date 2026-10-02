# Maintenance

## Startup Procedure
Read PROJECT.md, this file, ARCHITECTURE.md, recent CHANGELOG.md and relevant BACKLOG.md; inspect git state; establish a baseline before consequential changes.

## Build Procedure
Commands will be recorded after running them. Selected toolchain: Node 24, pnpm 11, TypeScript, Vite, Playwright. Do not infer native run/package commands; no native target exists yet.

## Platform Test Procedure
Track each actual browser/OS and viewport separately in docs/verification.md. Emulation is not physical iOS/Android verification. A successful build is not runtime verification.

## Document Safety Rules
Always export a new file. Never modify test input or original user file. For each mutation verify open → modify → export → reopen → persistence and unaffected content. Preserve unsaved state after cancellation/failure. Do not bypass document permissions or encryption. Treat signed PDFs as read-only unless signature-preserving updates are explicitly validated.

## Dependency Policy
Inspect current license, maintenance, security advisories, browser/mobile support and existing alternatives before adding dependencies. Pin consequential engines and keep the lockfile. Include redistribution notices. No confidential test documents.

## Release Procedure
No release has been made. Record actual release/build procedure after verification; native signing, installers and updates are deferred.

## Debugging Guidelines
Use reproducible synthetic fixtures, console/worker errors, stack traces, failing tests, render comparisons and measured profiles. Do not suppress failures to make a demo pass. Never log document content or passwords.
