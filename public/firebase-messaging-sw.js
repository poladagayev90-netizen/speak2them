importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
importScripts('/firebase-sw-config.js');

firebase.initializeApp(self.FIREBASE_SW_CONFIG);
const messaging = firebase.messaging();

// Data-only pushes (analysis_ready, daily_reminder) are displayed here.
// Messages that carry a notification payload (legacy topicReminder) are
// auto-displayed by the SDK — skip them to avoid duplicate notifications.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const data = payload.data || {};
  if (!data.title) return;
  // A call must not slip by as a quiet tray item: it stays up until tapped,
  // vibrates like a ring, and re-alerts even if an older call used the tag.
  const isCall = data.type === 'incoming_call';
  // event.waitUntil-equivalent: returning the promise keeps the worker alive
  // until the notification is actually shown (a killed worker shows nothing).
  return self.registration.showNotification(data.title, {
    body: data.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    // A missed call takes the place of the ring it follows. `data.tag` (the
    // call-reminder ladder: one tag per booking) keeps two different calls'
    // reminders from replacing each other — a tag per TYPE did exactly that.
    tag: data.type === 'missed_call' ? 'incoming_call' : (data.tag || data.type || 'speaklab'),
    // A notification that replaces one under the same tag is SILENT unless
    // renotify is set — the 1 h reminder used to slide in over the 24 h one
    // without a sound. Every push here is worth hearing.
    renotify: true,
    data: { url: data.url || '/' },
    // A web page cannot ring full-screen like the Android app does, so this
    // is as strong as a browser allows: stays up until tapped, a long
    // ring-like vibration (Android browsers; iOS ignores it), and an Answer
    // button that opens the app, where the ringing call screen is waiting.
    ...(isCall ? {
      requireInteraction: true,
      vibrate: [600, 300, 600, 300, 600, 300, 600, 300, 600, 300, 600],
      actions: [{ action: 'answer', title: 'Answer' }, { action: 'dismiss', title: 'Not now' }],
    } : {}),
  });
});

// Route notification clicks to the URL the push carried: focus an open
// SpeakLab tab if there is one, otherwise open a new window.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // «Not now» only closes the notification; the caller's ring times out.
  if (event.action === 'dismiss') return;
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(url);
          return undefined;
        }
      }
      return clients.openWindow(url);
    })
  );
});
