/**
 * Reads the user's authentication credentials from the Java app's injected `#user-data`
 * form. Falls back to Vite env vars that are injected by local startup when the form
 * values are empty.
 *
 * In production the Java app always populates the form before the Vite bundle loads.
 * In local development, `npm start` injects Vite auth env vars only when `DEV_USER_EMAIL`
 * is set in `.env.local`. Without that setting the app runs without local credentials.
 */
export const getUserCredentials = (): { key: string | undefined; token: string | undefined } => {
  const formKey = (document.querySelector<HTMLInputElement>('#user-data [name="key"]')?.value ?? '').trim();
  const formToken = (document.querySelector<HTMLInputElement>('#user-data [name="token"]')?.value ?? '').trim();

  const key = formKey || import.meta.env.VITE_DEV_USER_KEY || undefined;
  const token = formToken || import.meta.env.VITE_DEV_USER_TOKEN || undefined;

  return { key, token };
};
