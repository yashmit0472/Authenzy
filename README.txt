Authenzy - Proxy Integration (fixed)
----------------------------------------
This build fixes rendering issues and computes a simple sentiment-derived rating (1-5) using aggregated comments.

Steps:
1. Start the proxy server (server.js scaffold provided earlier) and ensure it listens on http://localhost:3000
2. Load this extension (chrome://extensions -> Developer mode -> Load unpacked) and select the extracted folder
3. Open an Amazon product page and click 'Fetch Reviews' in the floating Authenzy card
4. Check the extension background service worker console and proxy logs if results are missing

Uploaded image path used as fallback sample:
  /mnt/data/824462a8-2edc-472a-9459-434581bc07ef.png
