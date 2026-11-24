# Connect BV Mining Solution to Supabase

The web app uses Supabase Auth and the database. Apply the SQL before signing in; database access is enforced by the included Row Level Security policies.

## 1. Apply the database SQL

In the Supabase project, open **SQL Editor** and run the files in this order:

1. [supabase-schema.sql](supabase-schema.sql)
2. [supabase-app-updates.sql](supabase-app-updates.sql)
3. [admin-users-migration.sql](admin-users-migration.sql) to show names in the account list and header.
4. [admin-user-management-migration.sql](admin-user-management-migration.sql) to grant the server-only role the permissions needed to edit and delete accounts.
5. [supabase-attendance-delete-migration.sql](supabase-attendance-delete-migration.sql) on an existing project, so deleting auto-marked attendance stays deleted for that date.
6. [role-access-migration.sql](role-access-migration.sql) on an existing project, to add the new roles and map old Supervisor/Viewer accounts to Foreman/Accountant.
7. [admin-only-editing-migration.sql](admin-only-editing-migration.sql) on an existing project, to apply the current record-entry access and keep saved-record edits/deletions Admin-only.
8. [audit-log-migration.sql](audit-log-migration.sql) to create the Admin-only audit trail and its database triggers.
9. [employee-actions-migration.sql](employee-actions-migration.sql) to add employee warnings, status changes/history, and suspend/reactivate controls.
10. [overtime-approval-migration.sql](overtime-approval-migration.sql) to add Admin-only overtime approval status and protect approvals with RLS.
11. [mining-reports-migration.sql](mining-reports-migration.sql) to add Mine Mate/Foreman shift reports and aggregate blast totals for the Dashboard.
12. [user-page-access-migration.sql](user-page-access-migration.sql) to store individual page access separately from role and apply those grants to app pages and record entry.

If this is an older project with the earlier employee schema, run [supabase-employee-fields-migration.sql](supabase-employee-fields-migration.sql) before the app updates file.

The app updates file adds Rock Tools item categories, minimum stock thresholds for low-stock alerts, and shift overtime storage. The `public` schema must be available to the Data API. Keep **Data API** enabled. If the create-project form has **Automatically expose new tables**, it can remain off because the SQL grants the app access explicitly.

The audit trail begins when [audit-log-migration.sql](audit-log-migration.sql) is run; it cannot reconstruct changes made before that point. Sensitive employee fields are redacted from audit details. Run [employee-actions-migration.sql](employee-actions-migration.sql) after the audit migration to include warning and status history events in the audit log.

## 2. Create the first administrator

1. Open **Authentication → Users** and create the HR administrator account.
2. In SQL Editor, promote that user's email:

   ```sql
   update public.user_profiles
   set role = 'admin'
   where email = 'your-email@example.com';
   ```

New accounts are assigned one of: Admin, HR, Accountant, Store, Mechanical, Mine Mate, Foreman, Project Manager, or Assistant Project Manager. Admins can separately select which app pages each non-admin account can open, regardless of role. Dashboard access is always available. Audit Log and User Management remain Admin-only. Page grants allow entry to the selected page; saved-record edits and deletions stay Admin-only. Admin can see and approve all leave requests; other users can submit and see their own requests. The Dashboard displays aggregate blast counts by shift for its selected date.

## 3. Enable admin-only account management

The **User management** link appears only for administrators. The page is also blocked for every other role. Deploy both Edge Functions with JWT verification enabled:

- [admin-create-user/index.ts](../supabase/functions/admin-create-user/index.ts), function name `admin-create-user`, creates accounts and assigns an initial role.
- [admin-manage-user/index.ts](../supabase/functions/admin-manage-user/index.ts), function name `admin-manage-user`, edits a user's name, designation, and role, or deletes that Auth account. It prevents deleting/demoting the last administrator and prevents an administrator from deleting or demoting their own account.

Deploy them from the Supabase Dashboard's **Edge Functions** editor or with the Supabase CLI. Both functions verify the signed-in caller's admin role before using Supabase Auth's server-only admin API. They rely on Supabase's server-side project secrets; never copy a secret/service-role key into the website. Deploy the current versions of both functions to enable saving individual page access when creating or editing accounts.

After deploying both functions, redeploy the static website. Deploy the updated function files again whenever you add or rename an access role. Account changes are also recorded in the audit trail. Admins can create accounts and set their temporary password (6–12 characters), edit user profiles and roles, or delete accounts from **User management**. Login email is shown read-only in the edit form; change it through Supabase Auth if needed.

## 4. Project connection settings

`assets/js/supabase-config.js` contains the project URL and browser-safe `anon`/publishable key. These are intended to be visible in a static website. Never put a database password, `service_role`, or secret key in this file.

## 5. Deploy

Deploy the entire project folder, keeping `assets/` and `database/` intact. Set the host publish directory to the project root. The first page is `index.html`; signed-out users are directed to `login.html`.

## Existing browser data

Previously saved `localStorage` data is not automatically imported into the new Supabase project. Export and migrate existing records before treating Supabase as the source of truth. The app shows an on-screen warning if a database write fails.
