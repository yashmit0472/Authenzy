// Authenzy content script - robust rendering of posts/comments and rating computation
(function() {
  function getProductTitle() {
    const t1 = document.getElementById('productTitle')?.innerText;
    if (t1) return t1.trim();
    const alt = document.querySelector('#titleSection h1')?.innerText || document.querySelector('.product-title-word-break')?.innerText;
    return alt ? alt.trim() : null;
  }
  function findASIN() {
    const url = location.href;
    const m = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
    if (m) return m[1];
    const metaAsin = document.querySelector('[data-asin]')?.getAttribute('data-asin');
    if (metaAsin) return metaAsin;
    const asinElem = document.getElementById('ASIN')?.value;
    if (asinElem) return asinElem;
    return null;
  }

  function createCard() {
    if (document.getElementById('authenzy-card')) return document.getElementById('authenzy-card');
    const card = document.createElement('div');
    card.id = 'authenzy-card';
    card.innerHTML = `
      <div id="authenzy-handle">Authenzy ▾</div>
      <div id="authenzy-body">
        <div id="authenzy-info">
          <img id="authenzy-sample" src="" alt="sample" />
          <div style="flex:1">
            <div id="authenzy-title">Detecting product...</div>
            <div id="authenzy-asin" class="authenzy-small"></div>
          </div>
        </div>
        <div id="authenzy-actions">
          <button id="authenzy-scan">Fetch Reviews</button>
          <button id="authenzy-close">×</button>
        </div>
        <div id="authenzy-result" style="display:none;">
          <div id="authenzy-rating" style="font-weight:800;margin-top:8px;">Rating: —</div>
          <div id="authenzy-summary" class="authenzy-small"></div>
          <div id="authenzy-reddit"></div>
          <div id="authenzy-youtube"></div>
        </div>
      </div>
    `;
    document.body.appendChild(card);

    const style = document.createElement('style');
    style.textContent = `
      #authenzy-card { position: fixed; right: 16px; top: 96px; width: 480px; max-height: 70vh; overflow:auto; z-index: 999999; font-family: Arial, sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,0.22); border-radius: 10px; background:#fff; }
      #authenzy-handle { background: #0b84ff; color:#fff; padding: 8px 12px; font-weight: 700; cursor: move; border-top-left-radius:10px;border-top-right-radius:10px; }
      #authenzy-body { padding: 12px; }
      #authenzy-info { display:flex; gap:10px; align-items:center; margin-bottom:6px; }
      #authenzy-info img { width:64px; height:64px; object-fit:cover; border-radius:6px; border:1px solid #ddd; }
      #authenzy-title { font-size:13px; font-weight:700; max-height:44px; overflow:hidden; }
      .authenzy-small { font-size:12px; color:#666; margin-top:4px; }
      #authenzy-actions { display:flex; gap:6px; margin-top:8px; }
      #authenzy-actions button { padding:8px 10px; border-radius:6px; border: none; cursor:pointer; font-weight:700; }
      #authenzy-scan { background: linear-gradient(90deg,#0b84ff,#0066cc); color:white; }
      #authenzy-close { background:#eee; }
      #authenzy-result { margin-top:12px; font-size:13px; }
      .authenzy-section-title { font-weight:800; margin-top:10px; }
      .authenzy-review { border-top:1px solid #eee; padding:8px 0; }
      .authenzy-comment { white-space:pre-wrap; margin-top:6px; background:#fafafa; padding:8px; border-radius:6px; font-size:13px; }
      .authenzy-meta { font-size:12px; color:#666; margin-top:6px; }
    `;
    document.head.appendChild(style);

    card.querySelector('#authenzy-close').addEventListener('click', ()=> card.remove());
    card.querySelector('#authenzy-scan').addEventListener('click', onFetch);

    // draggable
    let isDown=false, offsetX=0, offsetY=0;
    const handle = card.querySelector('#authenzy-handle');
    handle.addEventListener('mousedown', (e)=>{ isDown=true; offsetX=e.clientX - card.getBoundingClientRect().left; offsetY=e.clientY - card.getBoundingClientRect().top; });
    document.addEventListener('mousemove', (e)=>{ if(!isDown) return; card.style.left = (e.clientX - offsetX) + 'px'; card.style.top = (e.clientY - offsetY) + 'px'; card.style.right='auto'; });
    document.addEventListener('mouseup', ()=> isDown=false);

    return card;
  }

  function computeCommentSentiment(comment) {
    // Score a single comment's sentiment
    if (!comment) return 0;
    const negative = ['fake','scam','spoof','not real','ripoff','expired','contamin','allergic','bad','terrible','awful','danger','toxic','do not buy','avoid','worst','horrible','disappointed','waste','broken','defective','poor','cheap','unreliable'];
    const positive = ['authentic','genuine','works','good','great','legit','effective','recommend','love','excellent','best','amazing','perfect','outstanding','fantastic','wonderful','satisfied','quality','reliable','worth'];
    const lc = comment.toLowerCase();
    let pos=0, neg=0;
    for (const w of negative) { if (lc.includes(w)) neg++; }
    for (const w of positive) { if (lc.includes(w)) pos++; }
    // Return sentiment score: positive = positive count, negative = negative count
    return pos - neg;
  }

  function computeRatingFromComments(comments) {
    // Simple keyword-based sentiment scoring.
    if (!comments || comments.length === 0) return null;
    const negative = ['fake','scam','spoof','not real','ripoff','expired','contamin','allergic','bad','terrible','awful','danger','toxic','do not buy','avoid'];
    const positive = ['authentic','genuine','works','good','great','legit','effective','recommend','love','excellent','best'];
    let pos=0, neg=0, totalMatches=0;
    for (const c of comments) {
      if (!c) continue;
      const lc = c.toLowerCase();
      for (const w of negative) { if (lc.includes(w)) { neg++; totalMatches++; } }
      for (const w of positive) { if (lc.includes(w)) { pos++; totalMatches++; } }
    }
    // If no keyword matches, fallback to neutral score based on length/presence:
    if (totalMatches === 0) {
      // small heuristic: assume neutral (3 stars)
      return 3;
    }
    // sentiment score in [-1,1]
    const score = (pos - neg) / totalMatches;
    // map to 1..5: score -1 -> 1, 0 -> 3, +1 -> 5
    const rating = Math.round(((score + 1) / 2) * 4 + 1);
    return Math.max(1, Math.min(5, rating));
  }

  function renderResults(payload) {
    const res = document.getElementById('authenzy-result');
    const redditEl = document.getElementById('authenzy-reddit');
    const ytEl = document.getElementById('authenzy-youtube');
    res.style.display = 'block';
    
    const summaryEl = document.getElementById('authenzy-summary');
    if (payload.ai_summary) {
      // Display the AI-generated summary first
      summaryEl.innerHTML = `<div style="font-weight:700;margin-top:4px;color:#0b84ff;">AI Summary:</div> ${escapeHtml(payload.ai_summary)}<div class="authenzy-small" style="margin-top:6px;">Keyword Analysis below:</div>`;
    } else {
      summaryEl.textContent = 'Results fetched. Analyzing comments...';
    }

    // First, collect ALL comments for analysis (for rating calculation)
    let allComments = [];
    
    // Separate Reddit and YouTube comments
    let redditComments = [];
    let youtubeComments = [];
    
    if (payload.reddit?.results && Array.isArray(payload.reddit.results)) {
      payload.reddit.results.forEach(item => {
        if (item.comments) {
          redditComments.push(...item.comments);
          allComments.push(...item.comments);
        }
      });
    }
    if (payload.youtube?.results && Array.isArray(payload.youtube.results)) {
      payload.youtube.results.forEach(item => {
        if (item.comments) {
          youtubeComments.push(...item.comments);
          allComments.push(...item.comments);
        }
      });
    }

    // Score and sort Reddit comments by sentiment
    const scoredRedditComments = redditComments.map(c => ({
      text: c,
      score: computeCommentSentiment(c)
    })).sort((a, b) => b.score - a.score);

    // Get top 5 positive and negative from Reddit
    const topRedditPositive = scoredRedditComments.filter(c => c.score > 0).slice(0, 5);
    const topRedditNegative = scoredRedditComments.filter(c => c.score < 0).sort((a, b) => a.score - b.score).slice(0, 5);

    // Score and sort YouTube comments by sentiment
    const scoredYoutubeComments = youtubeComments.map(c => ({
      text: c,
      score: computeCommentSentiment(c)
    })).sort((a, b) => b.score - a.score);

    // Get top 5 positive and negative from YouTube
    const topYoutubePositive = scoredYoutubeComments.filter(c => c.score > 0).slice(0, 5);
    const topYoutubeNegative = scoredYoutubeComments.filter(c => c.score < 0).sort((a, b) => a.score - b.score).slice(0, 5);

    // Display Reddit section with top comments
    redditEl.innerHTML = '<div class="authenzy-section-title">Reddit posts & comments</div>';
    if (payload.reddit?.error) {
      redditEl.innerHTML += `<div class="authenzy-small">Error: ${escapeHtml(payload.reddit.error)}</div>`;
    } else {
      const items = payload.reddit.results || [];
      if (items.length === 0) {
        redditEl.innerHTML += `<div class="authenzy-small">No Reddit posts found for this query.</div>`;
      } else {
        redditEl.innerHTML += `<div class="authenzy-small" style="margin-bottom:8px;">Showing top comments from ${items.length} Reddit posts (${redditComments.length} Reddit comments analyzed)</div>`;
        
        // Display top 5 positive Reddit comments
        if (topRedditPositive.length > 0) {
          redditEl.innerHTML += `<div style="margin-top:12px;"><div style="font-weight:700;color:#0b84ff;margin-bottom:6px;">👍 Top 5 Positive Comments:</div>`;
          topRedditPositive.forEach(c => {
            redditEl.innerHTML += `<div class="authenzy-comment" style="border-left:3px solid #0b84ff;">${escapeHtml(c.text)}</div>`;
          });
          redditEl.innerHTML += `</div>`;
        }

        // Display top 5 negative Reddit comments
        if (topRedditNegative.length > 0) {
          redditEl.innerHTML += `<div style="margin-top:12px;"><div style="font-weight:700;color:#d32f2f;margin-bottom:6px;">👎 Top 5 Negative Comments:</div>`;
          topRedditNegative.forEach(c => {
            redditEl.innerHTML += `<div class="authenzy-comment" style="border-left:3px solid #d32f2f;">${escapeHtml(c.text)}</div>`;
          });
          redditEl.innerHTML += `</div>`;
        }
      }
    }

    // Display YouTube section with top comments
    ytEl.innerHTML = '<div class="authenzy-section-title">YouTube videos & top comments</div>';
    if (payload.youtube?.error) {
      ytEl.innerHTML += `<div class="authenzy-small">Error: ${escapeHtml(payload.youtube.error)}</div>`;
    } else {
      const vids = payload.youtube.results || [];
      if (vids.length === 0) {
        ytEl.innerHTML += `<div class="authenzy-small">No YouTube videos found for this query.</div>`;
      } else {
        ytEl.innerHTML += `<div class="authenzy-small" style="margin-bottom:8px;">Showing top comments from ${vids.length} YouTube videos (${youtubeComments.length} YouTube comments analyzed)</div>`;
        
        // Display top 5 positive YouTube comments
        if (topYoutubePositive.length > 0) {
          ytEl.innerHTML += `<div style="margin-top:12px;"><div style="font-weight:700;color:#0b84ff;margin-bottom:6px;">👍 Top 5 Positive Comments:</div>`;
          topYoutubePositive.forEach(c => {
            ytEl.innerHTML += `<div class="authenzy-comment" style="border-left:3px solid #0b84ff;">${escapeHtml(c.text)}</div>`;
          });
          ytEl.innerHTML += `</div>`;
        }

        // Display top 5 negative YouTube comments
        if (topYoutubeNegative.length > 0) {
          ytEl.innerHTML += `<div style="margin-top:12px;"><div style="font-weight:700;color:#d32f2f;margin-bottom:6px;">👎 Top 5 Negative Comments:</div>`;
          topYoutubeNegative.forEach(c => {
            ytEl.innerHTML += `<div class="authenzy-comment" style="border-left:3px solid #d32f2f;">${escapeHtml(c.text)}</div>`;
          });
          ytEl.innerHTML += `</div>`;
        }
      }
    }

    // compute rating from aggregated comments
    const rating = computeRatingFromComments(allComments);
    const ratingEl = document.getElementById('authenzy-rating');
    
    if (rating === null) {
      ratingEl.textContent = 'Rating: N/A (no comments)';
      if (!payload.ai_summary) summaryEl.textContent = `Fetched ${allComments.length} comments. Unable to compute sentiment-based rating.`;
    } else {
      ratingEl.textContent = `Rating: ${rating} / 5  (${allComments.length} comments analyzed)`;
      if (!payload.ai_summary) summaryEl.textContent = `Analyzed ${allComments.length} comments across sources to derive a simple sentiment rating.`;
    }
  }

  function escapeHtml(unsafe) {
    if (!unsafe && unsafe !== 0) return '';
    return unsafe.toString().replace(/[&<"'>]/g, function(m) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
  }

  async function onFetch() {
    const title = getProductTitle() || '';
    const asin = findASIN() || '';
    const query = title || asin;
    if (!query) {
      alert('Could not detect product title or ASIN to search reviews.');
      return;
    }
    const resultBox = document.getElementById('authenzy-result');
    resultBox.style.display = 'block';
    document.getElementById('authenzy-rating').textContent = 'Rating: Fetching...';
    document.getElementById('authenzy-summary').textContent = `Query: ${query}`;

    chrome.runtime.sendMessage({type:'fetchReviews', query, asin}, (resp) => {
      if (!resp) {
        document.getElementById('authenzy-summary').textContent = 'No response from background (check proxy is running on localhost:3000).';
        return;
      }
      renderResults(resp);
    });
  }

  // main
  (function main() {
    const title = getProductTitle();
    const card = createCard();
    if (title) document.getElementById('authenzy-title').innerText = title;
    const asin = findASIN(); if (asin) document.getElementById('authenzy-asin').innerText = 'ASIN: ' + asin;
    const prodImage = document.querySelector('#imgTagWrapperId img') || document.querySelector('#landingImage') || document.querySelector('.a-dynamic-image');
    const sample = document.getElementById('authenzy-sample');
    if (prodImage && prodImage.src) sample.src = prodImage.src;
    else sample.style.display = 'none';
  })();

})();