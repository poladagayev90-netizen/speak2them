importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
importScripts('/firebase-sw-config.js');

firebase.initializeApp(self.FIREBASE_SW_CONFIG);
firebase.messaging();
