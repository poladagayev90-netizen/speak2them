package com.speaklab.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    static final String EXTRA_CALL = "speaklab.incoming_call";
    private static volatile boolean foreground = false;

    // CallMessagingService rings natively only while the app is NOT on screen;
    // on screen, GlobalCallListener shows the call in-app.
    static boolean isInForeground() {
        return foreground;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleCallIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        foreground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        foreground = false;
    }

    // Opened from the ringing call: stop the ringtone, show over the lock
    // screen and wake the display.
    private void handleCallIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_CALL, false)) return;
        CallMessagingService.cancel(this);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            if ("answer".equals(intent.getStringExtra("call"))) {
                KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                if (km != null) km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
    }
}
