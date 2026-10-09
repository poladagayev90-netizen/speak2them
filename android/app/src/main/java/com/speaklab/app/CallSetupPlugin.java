package com.speaklab.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// What stands between a call and a ringing phone that is asleep (Polad
// 2026-10-10: «when the app sleeps, calls do not come — it must wake like
// WhatsApp»). The FCM push itself is high priority and wakes the phone; what
// stops the ring is the phone's settings: notifications or the Calls channel
// switched off, full-screen calls not allowed (Android 14+ asks per app), and
// battery savers that kill the app (Samsung «Sleeping apps», Xiaomi, Oppo…).
// status() reports each, open() takes the person to the exact settings page.
// src/utils/callSetup.js + components/CallRingSetup.jsx are the JS side.
@CapacitorPlugin(name = "CallSetup")
public class CallSetupPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        r.put("notifications", NotificationManagerCompat.from(ctx).areNotificationsEnabled());
        r.put("callChannel", callChannelOn(ctx));
        r.put("fullScreen", fullScreenAllowed(ctx));
        r.put("battery", batteryUnrestricted(ctx));
        r.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase());
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    @PluginMethod
    public void open(PluginCall call) {
        String target = call.getString("target", "app");
        Context ctx = getContext();
        String pkg = ctx.getPackageName();
        Intent i;
        switch (target) {
            case "notifications":
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
                break;
            case "channel":
                CallMessagingService.ensureChannelPublic(ctx);
                i = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
                        .putExtra(Settings.EXTRA_CHANNEL_ID, CallMessagingService.CHANNEL_ID)
                    : appDetails(pkg);
                break;
            case "fullScreen":
                i = Build.VERSION.SDK_INT >= 34
                    ? new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + pkg))
                    : appDetails(pkg);
                break;
            case "autostart":
                i = autostartIntent(ctx);
                if (i == null) i = appDetails(pkg);
                break;
            // battery: App info → Battery → «Unrestricted» lives on the app's
            // own page (the direct «ignore optimisations» request needs a
            // permission Play only allows for a few kinds of app).
            default:
                i = appDetails(pkg);
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(i);
        } catch (Exception e) {
            try {
                ctx.startActivity(appDetails(pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {
                call.reject("no-settings");
                return;
            }
        }
        call.resolve();
    }

    private static Intent appDetails(String pkg) {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
    }

    private static boolean callChannelOn(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return true;
        NotificationChannel ch = nm.getNotificationChannel(CallMessagingService.CHANNEL_ID);
        // Not created yet = created on the first call, with ringing on.
        return ch == null || ch.getImportance() >= NotificationManager.IMPORTANCE_HIGH;
    }

    private static boolean fullScreenAllowed(Context ctx) {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm == null || nm.canUseFullScreenIntent();
    }

    private static boolean batteryUnrestricted(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm == null || pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }

    // The makers' own «autostart» pages, where they exist. Unknown makers and
    // missing pages fall back to App info.
    private static Intent autostartIntent(Context ctx) {
        String[][] candidates = {
            { "com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity" },
            { "com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity" },
            { "com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity" },
            { "com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity" },
            { "com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
            { "com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity" },
        };
        for (String[] c : candidates) {
            Intent i = new Intent().setComponent(new ComponentName(c[0], c[1]));
            if (i.resolveActivity(ctx.getPackageManager()) != null) return i;
        }
        return null;
    }
}
