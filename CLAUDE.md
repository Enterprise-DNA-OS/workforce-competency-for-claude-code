# Workforce Competency for Claude Code

This is a coordinator's register for role requirements, observed skill levels, evidence, expiry and training follow-up. The demo is a fictional packing business. Ask the operator for their business context before adapting it.

Every answer starts with a current CLI read. Read a worker's full assessment history before writing a new result. No assessment may be invented. Ambiguous names list candidates and stop. Preview mutations, use the real operator's actor name and retain the audit record. The actor field is not an identity system.

## Routing

| Work | Recipe |
|---|---|
| employees | /employees |
| roles | /roles |
| skills | /skills |
| requirements | /requirements |
| assignments | /assignments |
| results | /results |
| matrix | /matrix |
| skills gap | /skills-gap |
| coverage | /coverage |
| single cover | /single-cover |
| renewals due | /renewals-due |
| approval queue | /approval-queue |
| training plan | /training-plan |
| owner load | /owner-load |
| attention | /attention |
| compliance | /compliance |
| activity | /activity |
| import history | /import-history |
| employee | /employee |
| weekly review | /weekly-review |
| add | /add |
| approve result | /approve-result |
| revoke result | /revoke-result |
| complete training | /complete-training |
| retire employee | /retire-employee |
| import | /import |
| export | /export |
| draft training plan | /draft-training-plan |
| draft assessment review | /draft-assessment-review |
| help | /help |
| Log an observed assessment | /log-assessment |
| Add a field or change a rule | /customise |
| Add a report | /new-view |

## Rules

Drafts go to drafts/ and send nothing. Never delete records or evidence to hide a failed check. Completing training does not approve competence. Approval and revocation need a recorded reason. A record check is not work authorisation or legal certification. Changes to operational requirements need the competent business reviewer.

Use scripts/competency.mjs for records, scripts/migrate.mjs for numbered migrations and scripts/seed.mjs only for disposable demos. Commands and field syntax live in docs/operations.md. Import guidance lives in docs/replace-ag5.md. Compliance sources and limitations live in docs/compliance.md. PostgreSQL and PGlite use the same schema. Shared production access requires separately designed identity, permissions, backups and restore testing.

Built and run for you through Omni by Enterprise DNA: https://enterprisedna.co/omni/instead-of/ag5
