package com.speaklab.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

// An incoming call that rings like a call (Polad 2026-10-07: between two
// phones a call arrived as an ordinary notification). From v29 the server
// sends `incoming_call` to this app as DATA ONLY (the token says caps:['ring']),
// so Android hands it here even when the app is closed, and we draw a call:
// a full-screen ringing screen on a locked phone, a looping ringtone and
// Answer / Decline. Everything else goes to Capacitor's push plugin as before.
//
// The taps open MainActivity with the same extras an FCM notification tap
// carries (google.message_id + data), so the push plugin passes them to JS as
// pushNotificationActionPerformed: src/nativePush.js -> utils/callIntent.js ->
// GlobalCallListener answers or declines once the call document arrives.
public class CallMessagingService extends MessagingService {

    static final String CHANNEL_ID = "calls";
    // FCM shows its own notifications with this tag and id 0, so the
    // missed_call push (tag "call") replaces our ringing one.
    static final String TAG = "call";
    static final int ID = 0;
    private static final long RING_MS = 45000;
    private static final long[] BUZZ = { 0, 800, 600, 800, 600 };

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if ("incoming_call".equals(data.get("type")) && message.getNotification() == null
                && !MainActivity.isInForeground()) {
            showIncomingCall(this, data);
            return;
        }
        // The app is open: GlobalCallListener already shows the call in-app.
        super.onMessageReceived(message);
    }

    static void showIncomingCall(Context ctx, Map<String, String> data) {
        String name = data.get("callerName");
        if (name == null || name.isEmpty()) name = "Someone";
        String callerId = data.get("callerId") == null ? "" : data.get("callerId");
        String body = data.get("body") == null ? "Incoming practice call" : data.get("body");
        ensureChannel(ctx);

        PendingIntent open = launch(ctx, "open", callerId, 1);
        PendingIntent answer = launch(ctx, "answer", callerId, 2);
        PendingIntent decline = launch(ctx, "decline", callerId, 3);

        Person caller = new Person.Builder().setName(name).setImportant(true).build();
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_speaklab)
            .setColor(0xFF6C3EF4)
            .setContentTitle(name)
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setTimeoutAfter(RING_MS)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
            .setVibrate(BUZZ)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, decline, answer));

        Notification n = b.build();
        // Keep ringing until answered, declined or timed out, like a phone call.
        n.flags |= Notification.FLAG_INSISTENT;
        try {
            NotificationManagerCompat.from(ctx).notify(TAG, ID, n);
        } catch (SecurityException e) {
            // Notifications are switched off for the app: nothing to show.
            return;
        }
        wakeScreen(ctx);
    }

    // A phone asleep in a pocket: light the screen for the ring, the way a
    // call does. With full-screen calls allowed Android does this itself; on
    // Android 14+ without that permission the call is only a heads-up
    // notification, and a dark screen hides it (2026-10-10).
    @SuppressWarnings("deprecation")
    private static void wakeScreen(Context ctx) {
        try {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm == null || pm.isInteractive()) return;
            PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                "speaklab:incoming_call");
            wl.acquire(10000);
        } catch (Exception ignored) {
            // A maker that refuses the wake lock: the ringtone still plays.
        }
    }

    // CallSetupPlugin opens the channel's settings page; it must exist first.
    static void ensureChannelPublic(Context ctx) {
        ensureChannel(ctx);
    }

    private static PendingIntent launch(Context ctx, String action, String callerId, int code) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("google.message_id", "call-" + action + "-" + System.currentTimeMillis());
        i.putExtra("type", "incoming_call");
        i.putExtra("call", action);
        i.putExtra("callerId", callerId);
        i.putExtra(MainActivity.EXTRA_CALL, true);
        return PendingIntent.getActivity(ctx, code, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Practice calls from your partners");
        Uri ring = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        ch.setSound(ring, attrs);
        ch.enableVibration(true);
        ch.setVibrationPattern(BUZZ);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    // Stops the ringing (the person tapped Answer, Decline or the screen).
    static void cancel(Context ctx) {
        NotificationManagerCompat.from(ctx).cancel(TAG, ID);
    }
}
