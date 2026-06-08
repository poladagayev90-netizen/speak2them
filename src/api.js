import { auth } from './firebase';

export async function authedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const idToken = await user.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...options.headers,
    },
  });
}
