// background.js - forwards fetchReviews to local proxy and returns payload to content script
const PROXY_BASE = 'http://localhost:3000';

async function fetchFromProxy(query, asin='') {
  try {
    const url = `${PROXY_BASE}/api/reviews?query=${encodeURIComponent(query)}&asin=${encodeURIComponent(asin)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const body = await resp.text().catch(()=>'<no body>');
      console.error('Proxy fetch failed', resp.status, body);
      return { error: 'Proxy fetch failed: ' + resp.status + ' ' + body };
    }
    const json = await resp.json();
    return json;
  } catch (e) {
    console.error('Proxy fetch exception', e);
    return { error: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'fetchReviews') {
    const query = msg.query || '';
    const asin = msg.asin || '';
    fetchFromProxy(query, asin).then(data => {
      // compute basic rating server-side? Let content compute for visibility
      sendResponse(data);
    }).catch(err => sendResponse({ error: String(err) }));
    return true;
  }
});
