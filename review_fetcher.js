// review_fetcher.js - Uses AI to generate unique reviews for each product

// Generate AI-powered Reddit posts and comments
async function generateAIRedditReviews(ai, productQuery, asin) {
  const asinPart = asin ? ` (ASIN: ${asin})` : '';
  const prompt = `Generate 5 realistic Reddit discussion posts about the product: "${productQuery}"${asinPart}.

For each post, provide:
1. A realistic Reddit post title (as if someone is asking for reviews or sharing experience)
2. A subreddit name (like "reviews", "ProductReviews", "BuyItForLife", "Frugal", etc. - choose appropriate one)
3. A username (realistic Reddit username)
4. Exactly 10 realistic user comments responding to the post (mix of positive, negative, and neutral experiences)

Format as JSON:
{
  "results": [
    {
      "post": {
        "title": "post title here",
        "subreddit": "subreddit name",
        "author": "username"
      },
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    },
    {
      "post": {
        "title": "post title here",
        "subreddit": "subreddit name",
        "author": "username"
      },
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    },
    {
      "post": {
        "title": "post title here",
        "subreddit": "subreddit name",
        "author": "username"
      },
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    },
    {
      "post": {
        "title": "post title here",
        "subreddit": "subreddit name",
        "author": "username"
      },
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    },
    {
      "post": {
        "title": "post title here",
        "subreddit": "subreddit name",
        "author": "username"
      },
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    }
  ]
}

Make the reviews realistic, varied, and specific to the product. Include concerns about authenticity, quality, value, and user experiences. Return ONLY valid JSON, no other text.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    
    const responseText = response.text ? response.text.trim() : '';
    console.log("AI Reddit Response (first 200 chars):", responseText.substring(0, 200));
    
    // Extract JSON from response (in case AI adds extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Construct URLs for each post
      if (parsed.results && Array.isArray(parsed.results)) {
        parsed.results.forEach(result => {
          if (result.post && result.post.subreddit) {
            result.post.url = `https://www.reddit.com/r/${result.post.subreddit}/search?q=${encodeURIComponent(productQuery)}`;
          }
        });
      }
      return parsed;
    }
    throw new Error(`No valid JSON found in AI response. Response: ${responseText.substring(0, 500)}`);
  } catch (error) {
    console.error("AI Reddit generation failed:", error.message, error.stack);
    return { results: [] };
  }
}

// Generate AI-powered YouTube videos and comments
async function generateAIYouTubeReviews(ai, productQuery, asin) {
  const asinPart = asin ? ` (ASIN: ${asin})` : '';
  const prompt = `Generate 5 realistic YouTube review videos about the product: "${productQuery}"${asinPart}.

For each video, provide:
1. A realistic YouTube video title (as if it's a review or unboxing video)
2. A YouTube search URL
3. Exactly 10 realistic top comments from viewers (mix of positive, negative, and neutral)

Format as JSON:
{
  "results": [
    {
      "title": "video title here",
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    },
    {
      "title": "video title here",
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    },
    {
      "title": "video title here",
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    },
    {
      "title": "video title here",
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    },
    {
      "title": "video title here",
      "comments": ["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7", "comment 8", "comment 9", "comment 10"]
    }
  ]
}

Make the reviews realistic, varied, and specific to the product. Include concerns about authenticity, quality, value, and user experiences. Return ONLY valid JSON, no other text.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    
    const responseText = response.text ? response.text.trim() : '';
    console.log("AI YouTube Response (first 200 chars):", responseText.substring(0, 200));
    
    // Extract JSON from response (in case AI adds extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Construct URLs for each video
      if (parsed.results && Array.isArray(parsed.results)) {
        parsed.results.forEach(result => {
          result.url = `https://www.youtube.com/results?search_query=${encodeURIComponent(productQuery + " review")}`;
        });
      }
      return parsed;
    }
    throw new Error(`No valid JSON found in AI response. Response: ${responseText.substring(0, 500)}`);
  } catch (error) {
    console.error("AI YouTube generation failed:", error.message, error.stack);
    return { results: [] };
  }
}

// The main function that server.js calls
async function fetchReviews(query, asin, ai) {
    if (query === '' && asin === '') return null; // Handle empty query
    if (!ai) {
      console.error("AI client not provided to fetchReviews");
      return null;
    }
    
    // Generate AI-powered reviews
    const [redditData, youtubeData] = await Promise.all([
      generateAIRedditReviews(ai, query, asin),
      generateAIYouTubeReviews(ai, query, asin)
    ]);

    return {
      reddit: redditData,
      youtube: youtubeData
    };
}

module.exports = {
    fetchReviews,
};