importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
importScripts('/firebase-sw-config.js');

firebase.initializeApp(self.FIREBASE_SW_CONFIG);
const messaging = firebase.messaging();

// Data-only pushes (analysis_ready, session_reminder) are displayed here.
// Messages that carry a notification payload (legacy topicReminder) are
// auto-displayed by the SDK — skip them to avoid duplicate notifications.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const data = payload.data || {};
  if (!data.title) return;
  // A call must not slip by as a quiet tray item: it stays up until tapped,
  // vibrates like a ring, and re-alerts even if an older call used the tag.
  const isCall = data.type === 'incoming_call';
  self.registration.showNotification(data.title, {
    body: data.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    // A missed call takes the place of the ring it follows.
    tag: data.type === 'missed_call' ? 'incoming_call' : (data.type || 'speaklab'),
    data: { url: data.url || '/' },
    ...(isCall ? { requireInteraction: true, renotify: true, vibrate: [400, 200, 400, 200, 400] } : {}),
  });
});

// Route notification clicks to the URL the push carried: focus an open
// SpeakLab tab if there is one, otherwise open a new window.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
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
