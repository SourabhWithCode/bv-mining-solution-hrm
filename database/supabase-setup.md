# Connect BV Mining Solution to Supabase

The web app uses Supabase Auth and the database. Apply the SQL before signing in; database access is enforced by the included Row Level Security policies.

## 1. Apply the database SQL

In the Supabase project, open **SQL Editor** and run the files in this order:

1. [supabase-schema.sql](supabase-schema.sql)
2. [supabase-app-updates.sql](supabase-app-updates.sql)
3. [admin-users-migration.sql](admin-users-migration.sql) to show names in the account list and header.

If this is an older project with the earlier employee schema, run [supabase-employee-fields-migration.sql](supabase-employee-fields-migration.sql) before the app updates file.

The app updates file adds Rock Tools item categories and shift overtime storage. The `public` schema must be available to the Data API. Keep **Data API** enabled. If the create-project form has **Automatically expose new tables**, it can remain off because the SQL grants the app access explicitly.

## 2. Create the first administrator

1. Open **Authentication → Users** and create the HR administrator account.
2. In SQL Editor, promote that user's email:

   ```sql
   update public.user_profiles
   set role = 'admin'
   where email = 'your-email@example.com';
   ```

New Auth accounts start with the `viewer` role. The administrator can later assign `hr`, `supervisor`, or `viewer` in `public.user_profiles`. HR/Admin can manage employee and stock records; Supervisors can manage shifts and attendance. Employee Records pages are limited to HR/Admin.

## 3. Enable admin-only account creation

The **User management** link appears only for administrators. The page is also blocked for every other role. To create accounts (including additional admins), deploy the Edge Function in [supabase/functions/admin-create-user/index.ts](../supabase/functions/admin-create-user/index.ts) with the function name `admin-create-user` and keep JWT verification enabled. Deploy it from the Supabase Dashboard's **Edge Functions** editor or with the Supabase CLI. The function checks that the signed-in caller has the `admin` role before using Supabase Auth's server-only user creation API. It relies on Supabase's server-side project secrets; never copy a secret/service-role key into the website.

After deployment, redeploy the static website. Admins can then create an account, choose its role, and set its temporary password from **User management**. New passwords must be 6–12 characters; share them securely and ask the new user to change the password after signing in.

## 4. Project connection settings

`assets/js/supabase-config.js` contains the project URL and browser-safe `anon`/publishable key. These are intended to be visible in a static website. Never put a database password, `service_role`, or secret key in this file.

## 5. Deploy

Deploy the entire project folder, keeping `assets/` and `database/` intact. Set the host publish directory to the project root. The first page is `index.html`; signed-out users are directed to `login.html`.

## Existing browser data

Previously saved `localStorage` data is not automatically imported into the new Supabase project. Export and migrate existing records before treating Supabase as the source of truth. The app shows an on-screen warning if a database write fails.
