# DOX Framework

<!-- DOX-VERSION: 1.7 -->

* DOX is an AGENTS.md hierarchy installed in this repository.
* Agents must follow DOX instructions across any edits.
* DOX governs repository work only and does not override higher-priority system, platform, legal, or safety requirements.

## Core Contract

* AGENTS.md files are binding work contracts for their subtrees.
* Durable artifacts (code, docs, specs, reports, diagrams, assets, workflows, records) must remain understandable from the applicable DOX chain.
* Child docs may add constraints but may not contradict or weaken DOX.

## Read Before Editing

1. Read the root AGENTS.md.
2. Identify all paths you expect to touch.
3. Read every AGENTS.md from root to each target path.
4. Read any child AGENTS.md whose scope contains the target.
5. Use the nearest doc as the local contract and parents for repository-wide rules.
6. If docs conflict, the closer doc wins unless it weakens DOX.

Do not rely on prior-session memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass.

Meaningful changes include modifications affecting:

* behavior
* structure
* ownership
* responsibilities
* workflows
* contracts
* durable documentation
* operating procedures
* user preferences

Update the nearest owning AGENTS.md when these change:

* purpose, scope, ownership, responsibilities
* contracts, workflows, operating rules
* inputs, outputs, permissions, constraints, side effects
* durable artifacts or documentation obligations
* user preferences
* AGENTS.md creation, deletion, move, rename, or index contents

Update affected parent and child docs as required.

Remove stale or contradictory text immediately.

Edits that do not affect any item in the meaningful change list above may leave docs unchanged, but the DOX pass is still required.

## Hierarchy

Root AGENTS.md owns:

* repository-wide rules
* global preferences
* workflow standards
* top-level Child DOX Index

Child AGENTS.md files own domain-specific instructions and their own Child DOX Index.

## Child Doc Shape

Create a child AGENTS.md only for durable boundaries with distinct:

* purpose
* responsibilities
* workflow
* contracts
* quality standards

Default sections:

* Purpose
* Ownership
* Local Contracts
* Work Guidance
* Verification
* Child DOX Index

Leave Work Guidance or Verification empty if no local standards or checks exist yet.

## Style

* Keep docs concise, current, and operational.
* Document stable contracts, not history.
* Put broad rules in parents and specifics in children.
* Avoid duplication.
* Prefer deletion over deprecation notes.
* Remove obsolete content.

## Closeout

1. Re-check affected paths against the DOX chain.
2. Update required docs.
3. Refresh affected Child DOX Indexes.
4. Remove stale content.
5. Run existing verification when relevant.
6. Report intentionally unchanged docs and why.
7. Complete the DOX compliance check (see Compliance section).
8. Remove or update any active ownership notes created during the task.

## Compliance

Every task summary must include:

```text
DOX COMPLIANCE
  Chain read: <paths or none>
  Docs updated: <paths or none>
  Indexes refreshed: <paths or none>
  Conflicts found: <details or none>
  Violations: <details or none>
  Fix required: <details or none>
```

Rules:

* No empty fields.
* Use "none" explicitly.
* If Chain read is empty, read the chain and re-run compliance before closing.
* If compliance cannot be completed, write:
  COMPLIANCE INCOMPLETE: <reason>
* Evidence must name actual files.

## Concurrent Write Protocol

Before writing any AGENTS.md:

1. Re-read the target file immediately before writing.
2. Compare against the current version if previously read.
3. Never overwrite another agent's changes silently.

Conflict priority:

* Closer doc wins rule conflicts.
* More recent version wins index-entry changes when reliable timestamps exist.
* If intent cannot be determined safely, halt and report ambiguity.

Safe update flow:

```text
READ
→ DIFF
→ MERGE
→ FLAG
→ WRITE
```

### Multi-Agent Safety

Before editing durable files, check for an active ownership mechanism.

If `.dox/active-work.md` does not exist, create it before proceeding.

Review existing entries, then record the current task with:

* agent or task name
* affected paths
* start time
* intended change

If another active entry overlaps the same paths:

* Do not write blindly.
* Merge only clearly non-conflicting changes.
* Otherwise halt and report the overlap.

Concurrent bootstrap:

* Re-read before writing.
* Extend existing indexes.
* Preserve valid entries.

## Bootstrap Protocol

Before initializing DOX:

1. List directories to depth 3.
2. Identify durable boundaries.
3. Propose a DOX tree.
4. Wait for user confirmation.

Rules:

* Create AGENTS.md only for confirmed durable boundaries.
* Never create AGENTS.md in build/, dist/, .cache/, tmp/, `__pycache__`/, or node_modules/.
* Small repositories may need only a root AGENTS.md.
* Prefer deeper ownership boundaries over shallow stubs.

Special modes:

* `Initialize DOX incrementally` → create only root AGENTS.md and a top-level index stub.
* `DOX dry run` → output proposed structure only.

After initialization:

* Populate Child DOX Index entries.
* Remove bootstrap placeholders.

## User Preferences

Record durable user preferences here or in the appropriate child AGENTS.md.

During initial DOX setup ask:

> Any preferences to record now? (e.g. commit style, language, output format, review depth)

*No preferences recorded.*

## Child DOX Index

- `backend/AGENTS.md` — Backend domain (FastAPI, SQLAlchemy, scrapers)
- `frontend/AGENTS.md` — Frontend domain (React, TypeScript, Tailwind)
