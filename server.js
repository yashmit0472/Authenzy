// server.js - Proxy server with Gemini API Integration
// 
// To run this:
// 1. Install Node.js
// 2. Open your terminal in this folder and run:
//    npm install express dotenv @google/genai
// 3. Run the server:
//    node server.js
//
// The server will run on http://localhost:3000

const express = require('express');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');
const { fetchReviews } = require('./review_fetcher'); // Import the new fetcher
const app = express();
const port = 3000;

// Load environment variables from .env file
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("FATAL: GEMINI_API_KEY not found. Please ensure .env file is correct.");
  process.exit(1);
}

// Initialize the Gemini AI client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
console.log(`✅ Gemini AI client initialized and ready.`);


// Function to generate the AI summary
async function generateAISummary(productQuery, comments) {
  if (comments.length === 0) {
      return "AI analysis could not be performed as no comments were found for this product query.";
  }

  const commentText = comments.join('\n---\n'); // Join comments for analysis
  
  const prompt = `Analyze the following user comments for the product: "${productQuery}". 
    Do not mention Reddit or YouTube. 
    1. Summarize the overall sentiment (positive, negative, mixed).
    2. Identify the single most common complaint or concern.
    
    Format the output strictly as a single paragraph.

    Comments:
    ---
    ${commentText}
    ---
    `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    // Clean up the response text for display
    return response.text ? response.text.trim() : "AI analysis failed - no response text";
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return "AI analysis failed due to an API error. See server console for details.";
  }
}


app.get('/api/reviews', async (req, res) => {
  const { query, asin } = req.query;
  console.log(`Received request for: Query='${query}', ASIN='${asin}'`);
  
  // 1. Fetch AI-Generated Reviews
  const reviewData = await fetchReviews(query, asin, ai);
  if (!reviewData) {
      return res.status(404).json({ error: "Could not generate review data." });
  }

  // 2. Aggregate comments from fetched data
  let allComments = [];
  if (reviewData.reddit && reviewData.reddit.results && Array.isArray(reviewData.reddit.results)) {
    reviewData.reddit.results.forEach(item => {
      if (item.comments) allComments.push(...item.comments);
    });
  }
  if (reviewData.youtube && reviewData.youtube.results && Array.isArray(reviewData.youtube.results)) {
    reviewData.youtube.results.forEach(item => {
      if (item.comments) allComments.push(...item.comments);
    });
  }
  
  // 3. Generate AI Summary using Gemini
  const aiSummary = await generateAISummary(query, allComments);
  
  // 4. Return the final payload
  const finalResponse = {
    ...reviewData, // <-- Now contains the dynamic mock content
    ai_summary: aiSummary,
  };
  
  res.json(finalResponse);
});

app.listen(port, () => {
  console.log(`🌐 Authenzy Proxy Server (with Gemini AI) listening at http://localhost:${port}`);
});