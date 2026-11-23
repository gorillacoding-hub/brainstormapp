package com.gorillacoding.filament;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
  private static final int BACKGROUND = 0xFF12110F;
  private boolean fullscreen = true;

  /** JS-callable: FullView.set({ enabled: true | false }). */
  @CapacitorPlugin(name = "FullView")
  public static class FullViewPlugin extends Plugin {
    @PluginMethod
    public void set(final PluginCall call) {
      final boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
      getActivity()
          .runOnUiThread(
              () -> {
                ((MainActivity) getActivity()).applyFullscreen(enabled);
                call.resolve();
              });
    }
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FullViewPlugin.class);
    super.onCreate(savedInstanceState);

    Window window = getWindow();
    WindowCompat.setDecorFitsSystemWindows(window, false);
    if (Build.VERSION.SDK_INT >= 28) {
      window.getAttributes().layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }
    if (Build.VERSION.SDK_INT < 35) {
      window.setStatusBarColor(BACKGROUND);
      window.setNavigationBarColor(BACKGROUND);
    }

    // Keep the app clear of whatever system bars / notch / keyboard are visible,
    // so the on-screen buttons are never hidden underneath them.
    View content = findViewById(android.R.id.content);
    content.setBackgroundColor(BACKGROUND);
    ViewCompat.setOnApplyWindowInsetsListener(
        content,
        (view, insets) -> {
          Insets pad =
              insets.getInsets(
                  WindowInsetsCompat.Type.systemBars()
                      | WindowInsetsCompat.Type.displayCutout()
                      | WindowInsetsCompat.Type.ime());
          view.setPadding(pad.left, pad.top, pad.right, pad.bottom);
          return WindowInsetsCompat.CONSUMED;
        });

    applyFullscreen(true);
  }

  public void applyFullscreen(boolean on) {
    fullscreen = on;
    Window window = getWindow();
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(window, window.getDecorView());
    controller.setAppearanceLightStatusBars(false);
    controller.setAppearanceLightNavigationBars(false);
    if (on) {
      controller.setSystemBarsBehavior(
          WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      controller.hide(WindowInsetsCompat.Type.systemBars());
    } else {
      controller.show(WindowInsetsCompat.Type.systemBars());
    }
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) applyFullscreen(fullscreen);
  }
}
