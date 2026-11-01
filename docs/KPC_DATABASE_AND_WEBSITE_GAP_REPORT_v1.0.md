# KutchPharmaConnect — Database & Website Gap Report

**Version:** 1.0  
**Date:** 1 November 2026  
**Audit type:** Read-only inspection of live Supabase metadata/data and GitHub default-branch source  
**Production changes made:** None  
**Working branch:** `kpc-governance-spec-v1`

This report translates the approved Master Operating Specification into a prioritised technical worklist. Findings below are based on the inspected production schema, RLS policies, functions, triggers, storage policies, record counts and repository source. No production records or policies have been changed.

## Executive assessment

KPC already has most of the necessary core entities: companies, parent-company links, company groups, divisions, brands, products, distributors and distributorships. The correct direction is to **repair and simplify the existing system**, not replace it wholesale.

The highest-priority issue is that **7 active distributorships are unverified but the public RLS policy allows every active distributorship to be read**. There is also a hard-coded service-role JWT in a database notification trigger. These are security/governance issues, not visual-design issues.

The current website also exposes public distributor intake, has many separate admin modules, includes permanent-delete controls and contains multiple routes that can create distributor relationships. These must be consolidated around the approved policies.

---

## 1. Priority 0 — Security and public data exposure

### P0.1 Active but unverified distributorships are publicly readable

**Confirmed facts**
- 1,261 distributorship rows.
- 1,249 active + verified.
- **7 active + unverified.**
- 1 inactive + needs review.
- 4 inactive + verified.
- The public RLS policy on `distributorships` checks only `status = active`; it does not require `verification_status = verified`.

**Required correction**
- Public access must require active lifecycle status, verified relationship status, active company and distributor, and valid explicit scope.
- Apply the same rule consistently to search, profile queries, SEO generation, public counts and product/distributor discovery.
- Keep non-verified rows accessible only to authorised admins.

**Release test**
- Anonymous requests cannot read the 7 active/unverified relationships.
- All verified active relationships remain available.
- Inactive or missing linked entities are not exposed.

### P0.2 Privileged token hard-coded in a database trigger

**Confirmed fact**
- The `notify_distributor_submission` trigger calls the distributor-notification Edge Function with a hard-coded service-role JWT in the trigger's HTTP header configuration.
- The frontend Supabase client in `src/lib/supabase.js` uses the publishable key, not a service-role key. The hard-coded token was found in database trigger metadata, not in that frontend client file.

**Required correction**
- Treat the hard-coded privileged credential as exposed to anyone with sufficient database metadata access.
- Rotate the service-role secret through Supabase project settings.
- Replace trigger authentication with a supported server-side secret/configuration approach.
- Confirm the notification function still works after rotation.
- Search database functions, triggers, migrations, logs and repository history for any other privileged credentials.

**Owner action required**
- The connected Supabase tools do not expose project-level service-role key rotation. The owner must rotate it in the Supabase Dashboard. Do not paste the replacement key into ChatGPT, GitHub issues or source files.

### P0.3 Public distributor intake contradicts the approved Admin-only policy

**Confirmed facts**
- `distributor_submissions` has an INSERT policy for `anon` and `authenticated` users when status is open.
- The public application imports and renders a distributor-submission launcher/form.
- The private `distributor-submission-files` bucket allows public uploads to the `incoming` folder.
- Authenticated users can read objects in that submission bucket; the policy is not limited to admins.

**Required correction**
- Disable public distributor-submission entry points and anonymous/authenticated submission INSERT permissions.
- Restrict private submission-file reads to active admins.
- Preserve existing submission rows and files until retention and dependency review is complete.
- Keep public correction reports, which are a separate and approved mechanism.

### P0.4 Product-level distributor links are outside the approved standard workflow

**Confirmed facts**
- `product_distributors` contains zero rows.
- Its public SELECT policy allows rows with active lifecycle status, without requiring verified status.
- `publish_product_submission` can create product-level distributor rows with active + unverified status.
- Product profile code queries both `product_distributors` and company-level distributorships.

**Required correction**
- Keep product-level distributor mapping out of standard admin/public workflows.
- Do not expose unverified product-level links.
- Product pages should use explicit verified company/division/optional brand distributorship scope and label the scope accurately.
- Retain the table until code, migration, storage and historical dependencies are fully assessed.

---

## 2. Priority 1 — Verification and relationship integrity

### P1.1 Approval currently auto-marks submitted relationships as verified

The `publish_distributor_submission` function has an explicit admin check, but it inserts new relationships as active + verified and records the source as distributor submission. Admin approval of a distributor's own claim is not necessarily independent evidence.

**Required correction:** Admin review must capture a reliable source and evidence. Only then may the relationship become verified. Otherwise it remains unverified and hidden.

### P1.2 Verification state is duplicated

- `distributorships` has `verification_status`, `verified_date`, `verified_at`, `verification_note`, `verification_notes` and `source`.
- `verification_records` separately stores entity type, entity ID, status, date, verifier, source and notes.
- A SECURITY DEFINER trigger synchronises distributorship changes into `verification_records`.

**Required correction:** Decide the authoritative current status and the audit-history purpose of the second table. Preserve the existing history and trigger until a migration is tested. Do not delete columns or records during UI simplification.

### P1.3 Hierarchy integrity is only partially enforced

**Confirmed facts**
- Parent-company self-reference exists; direct self-parenting is blocked.
- No parent cycles were found in current data.
- Division/company mismatch checks exist for distributorships.
- Current data checks found no product/division or distributorship/division company mismatches.
- Product-to-company, product-to-division and product-to-brand are separate foreign keys; cross-company consistency is not fully enforced by a composite constraint/trigger.
- Brand-to-company exists; brand-to-division/company consistency has a composite foreign key.
- Distributorship brand/company consistency is not fully enforced by a composite foreign key/trigger.

**Required correction**
- Add tested validation for parent cycles and company/division/brand consistency on products and distributorships.
- Do not change current records until mismatch reports and exception handling are prepared.

### P1.4 Product duplicate candidates need human review

A preliminary scan found 19 candidate groups with the same company and normalized product name, with strength, dosage form and pack size blank. They are not confirmed duplicates.

**Required correction:** Generate a review list showing exact source rows, codes, names and relationships. Do not merge automatically.

### P1.5 Cadila company duplicate requires relationship-aware reconciliation

Two company records share the normalized name Cadila Healthcare Limited. Their products, aliases, distributorships, groups, parent links and SEO/profile references must be inspected before any merge.

---

## 3. Priority 2 — Admin workflow and destructive controls

### P2.1 Too many separate admin modules

The current dashboard has separate destinations for companies, distributors, products, distributorships, verification, divisions, brands, locations, categories, aliases, submissions, reviews, feedback, reports and a multi-purpose data workspace.

**Required target:** Four primary work areas:
1. Company Hierarchy
2. Distributors
3. Bulk Upload
4. Verification & Corrections

The underlying functions may remain separate where needed, but routine administration must be understandable through these four workflows.

### P2.2 Permanent-delete controls are too easy to reach

The UI calls SECURITY DEFINER RPCs to permanently delete companies, distributors and distributorships. The company deletion function removes products, distributorships, divisions, company categories and aliases. The distributor deletion function removes product mappings, product submissions, distributorships and may remove a location.

The functions include `is_admin()` checks and use an empty search path, but their destructive scope conflicts with the approved archive-first policy.

**Required correction**
- Make inactive/archive the default.
- Hide or restrict permanent deletion pending a dependency preview and explicit confirmation.
- Require backup, dependency report and recovery plan for exceptional deletion.
- Test every foreign-key/cascade impact.

### P2.3 Import staging contains retained data

Observed staging row counts:
- `import_companies`: 154
- `import_distributorships`: 166
- `import_distributors`: 4
- `import_divisions`: 1
- `import_aliases`: 18
- `import_locations`: 0

These may represent in-progress imports, previous attempts or retained audit data. Determine their source, owner, age, import batch and status before reuse or cleanup.

### P2.4 Current company hierarchy screen mixes unrelated tasks

The current hierarchy module loads products and product-distributor rows, and includes product entry and product-distributor editing alongside parent/child hierarchy management. This is inconsistent with the standard workflow and makes the task harder to understand.

**Required correction:** Keep company, subsidiary, division and brand relationships in Company Hierarchy. Keep distributor profiles in Distributors and distributorship mapping/verification in Verification & Corrections. Product catalogue management belongs within the company hierarchy/catalogue workflow, not a product-level distributor mapping workflow.

---

## 4. Priority 3 — Search and public presentation

### P3.1 Search aliases are incomplete

- Current aliases: 38 company, 1 division.
- The table's entity type constraint allows company, division and distributor, but not brand or product.
- Public alias SELECT policy permits company and division aliases only.
- Current application search separately queries company, distributor, division, brand, alias and location tables.

**Required correction:** Define a single alias policy and matching pipeline. Add brand/product aliases only if there is a demonstrated need and canonical matching/uniqueness rules are ready. Exact matches must outrank fuzzy matches.

### P3.2 Product page scope handling is incomplete

The current product detail query retrieves company-level distributorships by company ID without fully applying division scope. It must distinguish:
- Company-listed distributor;
- Division-listed distributor;
- Optional brand-listed distributor.

Do not infer stock.

### P3.3 Public company directory mixes hierarchy, product counts and distributorship counts

The current browse code derives company cards from relationships, products and parent/child links. It should be aligned to the agreed public hierarchy: company identity and subsidiaries first, relevant verified distributors prominent, product catalogue secondary.

### P3.4 Admin and public experience should not be redesigned independently

The same scope and verification rules must drive both admin and public screens. A visually improved UI is not acceptable if it displays a relationship differently from the database's actual scope.

---

## 5. Confirmed positive foundations

- Core entity tables already exist.
- UUIDs are generated by the database.
- Parent-company and company-group fields exist separately.
- Company/division/product/brand relationships have foreign keys.
- Distributorships are separate from distributor profiles.
- Current parent hierarchy has no cycles.
- No duplicate distributorship groups were found under the tested candidate key.
- The current 30 distributors are active.
- Public correction reports have a separate INSERT policy and can remain as the visitor correction channel.
- All inspected public-schema tables have RLS enabled.
- Admin-only functions inspected contain explicit `is_admin()` checks; the Supabase advisor warnings still justify a least-privilege grant review.
- Frontend uses a publishable key through environment variables, and the repository has a deployment workflow restricted to pushes to `main`.

These are reasons to repair the existing system rather than rebuild it.

---

## 6. Recommended implementation order

1. **Credential safety:** rotate the hard-coded service-role credential and replace notification trigger authentication.
2. **Public visibility:** prepare and test the verified-only distributorship policy; also prevent unverified product-level links from public access.
3. **Admin-only intake:** disable public distributor submission and restrict submission file storage access, retaining historical records.
4. **Verification integrity:** stop auto-verifying self-submitted distributorship claims; define evidence capture and one authoritative current state.
5. **Deletion safety:** replace routine permanent-delete actions with archive/inactivate and dependency previews.
6. **Hierarchy integrity:** add tested validation for parent cycles and cross-company product/distributorship brand/division consistency.
7. **Data cleanup:** review Cadila duplicate, 19 product candidate groups and import staging rows.
8. **Admin simplification:** consolidate navigation into the four approved work areas.
9. **Public search and presentation:** exact-first matching, aliases, verified-only scope-aware company/distributor pages and mobile QA.
10. **Release:** backup, test, reconcile and deploy only after all acceptance checks pass.

## 7. Explicit non-actions

During this audit:
- No Supabase table, row, policy, function, trigger, secret or storage object was modified.
- No GitHub default-branch file was changed.
- No production deployment was triggered.
- The Master Operating Specification and this report are stored on the separate `kpc-governance-spec-v1` branch only.

The next implementation work must start from a backup and a reviewed migration plan, not direct ad-hoc production edits.
