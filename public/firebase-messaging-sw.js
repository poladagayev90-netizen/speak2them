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
  self.registration.showNotification(data.title, {
    body: data.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: data.type || 'speaklab',
    data: { url: data.url || '/' },
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
