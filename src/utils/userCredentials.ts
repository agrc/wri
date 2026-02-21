/**
 * Reads the user's authentication credentials from the Java app's injected `#user-data`
 * form. Falls back to Vite env vars when the form values are empty (local development).
 *
 * In production the Java app always populates the form before the Vite bundle loads.
 * In local development, set VITE_DEV_USER_KEY and VITE_DEV_USER_TOKEN in .env.local.
 *
 * Available test credentials (matched to seeded dev users):
 *   dev-admin-key   / dev-admin-token   → GROUP_ADMIN   (allowEdits: true, all projects)
 *   dev-pm-key      / dev-pm-token      → GROUP_PM      (allowEdits: true only on qualifying projects)
 *   dev-public-key  / dev-public-token  → GROUP_PUBLIC  (allowEdits: false)
 *   dev-anon-key    / dev-anon-token    → GROUP_ANONYMOUS (allowEdits: false)
 */
export const getUserCredentials = (): { key: string | undefined; token: string | undefined } => {
  const formKey = (document.querySelector<HTMLInputElement>('#user-data [name="key"]')?.value ?? '').trim();
  const formToken = (document.querySelector<HTMLInputElement>('#user-data [name="token"]')?.value ?? '').trim();

  const key = formKey || import.meta.env.VITE_DEV_USER_KEY || undefined;
  const token = formToken || import.meta.env.VITE_DEV_USER_TOKEN || undefined;

  return { key, token };
};
