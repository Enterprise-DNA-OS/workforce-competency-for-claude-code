# Operating the register

## Setup and isolation

Node 20 or later. npm install, then npm run demo for fictional data. Keep the demo separate from working records. DATABASE_URL selects PostgreSQL; otherwise DATA_DIR selects local PGlite storage. Only one process should open a local PGlite directory at once. Dates and expiry checks use UTC calendar dates.

npm test uses a temporary PGlite database and temporary output directory. It exercises every command and removes its data afterwards. The manual CI workflow covers Windows/Linux. Its PostgreSQL job must explicitly use a disposable TEST_DATABASE_URL. Never set that to a working database.

All CLI commands support --json. Names match case-insensitively, UUID prefixes work, and stable codes take priority. Ambiguity prints every candidate and exits 1. Use --name=value syntax for flags. Read commands ignore no missing records: an empty result means no matching records in this database, not a certification of safety.

## Reads

employees, roles, skills, requirements, assignments, results, matrix, skills-gap, coverage, single-cover, renewals-due, approval-queue, training-plan, owner-load, attention, compliance, activity, import-history and help.

employee <code-or-name> returns the full worker record, matrix, assessment history and training. weekly-review returns coverage, attention and training together. single-cover includes every role/skill group below its configured minimum, not only those with exactly one person. The projection ages current expiry only; it does not schedule future assignments or predict absence. Roles without any active assignment are not represented in the site coverage view. Use requirements and assignments to reconcile the full role inventory.

## Add and log

Every mutation requires --actor and accepts --dry-run. Preview rolls back the record and audit entry. Fields use --underscored_name=value or --hyphenated-name=value. Add uses:

```bash
npm run competency -- add --kind=employees --code=E100 --name="Taylor Lee" --site=Hamilton --actor="Jess" --dry-run
npm run competency -- add --kind=results --code=R100 --employee=EMP-01 --skill=SK-01 --level=3 --assessed-on=2026-11-08 --assessor="Reviewer" --evidence="private:observed-check" --actor="Jess" --dry-run
```

| Kind | Required fields after code | Optional fields |
|---|---|---|
| employees | name, site | active, default true |
| roles | name | None |
| skills | name | evidence_required, default true |
| requirements | role, skill, minimum_level | minimum_cover, default 2 |
| assignments | employee, role, starts_on | ends_on |
| results | employee, skill, level, assessed_on, assessor | expires_on, evidence, status (default pending) |
| training | employee, skill, due_on, owner | evidence; status must start open |

New assessments append history. Dates must be real ISO dates. Future assessment dates, invalid levels, overlapping assignments and unknown fields are rejected. Approved results require evidence when the skill says so. Do not mark an imported result approved unless its evidence has actually been accepted.

## Review and follow-up

```bash
npm run competency -- approve-result RESULT-CODE --note="Evidence reviewed" --actor="Reviewer" --dry-run
npm run competency -- revoke-result RESULT-CODE --note="Evidence withdrawn" --actor="Reviewer" --dry-run
npm run competency -- complete-training TRAINING-CODE --evidence="private:attendance" --actor="Coordinator" --dry-run
npm run competency -- retire-employee EMPLOYEE-CODE --actor="Coordinator" --dry-run
```

Remove --dry-run for the authorised write. Retiring removes the person from current coverage but retains their history. A new observation is a new assessment. The most recent assessment date controls readiness, with creation time and identifier breaking same-date ties. Corrections and backdated imports need a deliberate history review. There is no permission to delete an unfavourable assessment.

## Import, backup and reports

See replace-ag5.md for the one-command mapped CSV/XLSX batch. export --file=<new-path> writes all business, audit and source records as JSON with private file permissions where the operating system supports them. Existing files are never overwritten. The JSON is a portable record snapshot, not an automatic restore command; keep tested PostgreSQL backups or a closed PGlite directory copy for recovery.

npm run docs renders worker competency records and training follow-up documents. npm run view renders three static dashboards. OUTPUT_DIR redirects generated output. draft-training-plan and draft-assessment-review write working documents under drafts/. Edit brand.json for your name, logo and colours. Outputs are private records and must not be published.

## Access and shared operation

The local operator and database owner are trusted. Row security is enabled and public grants are revoked; no browser or public API is provided. Shared use requires a separate least-privilege role design, authenticated actors and deployment-specific identity. An actor string is audit context, not proof of identity. The database owner can change records directly, so the audit is not tamper-proof. Maintain private evidence storage, retention rules, backups and a tested recovery process before using real employee records.
