# Patches the freshly generated Android project (android/ is NOT in the repo;
# `cap add android` recreates it on every build) to expose an AudioRoute
# JavascriptInterface for in-call audio output selection:
# earpiece / speaker / bluetooth, plus the Bluetooth permissions it needs.
# Fails loudly if any anchor is missing.

import glob
import sys

# --- 1. AndroidManifest: Bluetooth permissions ---
mp = "android/app/src/main/AndroidManifest.xml"
man = open(mp, encoding="utf-8").read()
changed = False
for perm in ("android.permission.BLUETOOTH", "android.permission.BLUETOOTH_CONNECT"):
    tag = '<uses-permission android:name="' + perm + '" />'
    if perm not in man:
        i = man.find("<uses-permission")
        if i < 0:
            print("FAILED: no uses-permission anchor in manifest")
            sys.exit(1)
        man = man[:i] + tag + "\n    " + man[i:]
        changed = True
if changed:
    open(mp, "w", encoding="utf-8").write(man)
    print("manifest bluetooth permissions ok")

# --- 2. MainActivity: AudioRoute bridge ---
paths = glob.glob("android/app/src/main/java/**/MainActivity.java", recursive=True)
if not paths:
    print("FAILED: MainActivity.java not found")
    sys.exit(1)
p = paths[0]
src = open(p, encoding="utf-8").read()
if "AudioRoute" in src:
    print("audio route bridge already present, skipping")
    sys.exit(0)
if "public class MainActivity extends BridgeActivity" not in src:
    print("FAILED: MainActivity anchor not found")
    sys.exit(1)
src = src.replace(
    "import com.getcapacitor.BridgeActivity;",
    "import com.getcapacitor.BridgeActivity;\n"
    "import android.Manifest;\n"
    "import android.content.Context;\n"
    "import android.content.pm.PackageManager;\n"
    "import android.media.AudioManager;\n"
    "import android.os.Bundle;\n"
    "import android.webkit.JavascriptInterface;",
)
bridge = """
    public class AudioRoute {
        private AudioManager am() {
            return (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        }
        @JavascriptInterface
        public void setEarpiece() {
            try {
                AudioManager a = am();
                a.setMode(AudioManager.MODE_IN_COMMUNICATION);
                a.setBluetoothScoOn(false);
                try { a.stopBluetoothSco(); } catch (Exception ignored) {}
                a.setSpeakerphoneOn(false);
            } catch (Exception ignored) {}
        }
        @JavascriptInterface
        public void setSpeaker() {
            try {
                AudioManager a = am();
                a.setMode(AudioManager.MODE_IN_COMMUNICATION);
                a.setBluetoothScoOn(false);
                try { a.stopBluetoothSco(); } catch (Exception ignored) {}
                a.setSpeakerphoneOn(true);
            } catch (Exception ignored) {}
        }
        @JavascriptInterface
        public void setBluetooth() {
            try {
                if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, 1001);
                    return;
                }
                AudioManager a = am();
                a.setMode(AudioManager.MODE_IN_COMMUNICATION);
                a.setSpeakerphoneOn(false);
                a.setBluetoothScoOn(true);
                a.startBluetoothSco();
            } catch (Exception ignored) {}
        }
        @JavascriptInterface
        public String getState() {
            try {
                AudioManager a = am();
                return "speaker=" + (a.isSpeakerphoneOn() ? 1 : 0)
                    + ",bluetooth=" + (a.isBluetoothScoOn() ? 1 : 0)
                    + ",bt=" + (a.isBluetoothScoAvailableOffCall() ? 1 : 0)
                    + ",wired=" + (a.isWiredHeadsetOn() ? 1 : 0);
            } catch (Exception e) {
                return "speaker=0,bluetooth=0,bt=0,wired=0";
            }
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            getBridge().getWebView().addJavascriptInterface(new AudioRoute(), "AudioRoute");
        } catch (Exception ignored) {}
    }
"""
src = src.replace(
    "public class MainActivity extends BridgeActivity {",
    "public class MainActivity extends BridgeActivity {\n" + bridge,
)
open(p, "w", encoding="utf-8").write(src)
print("audio route bridge ok")
