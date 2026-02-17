// This file runs when the Next.js server starts (cold start on Vercel)
// Setting TZ here ensures ALL new Date() calls use Pakistan time
export async function register() {
  process.env.TZ = 'Asia/Karachi';
}
