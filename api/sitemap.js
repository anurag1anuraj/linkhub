const admin = require("firebase-admin");

if (!admin.apps.length) {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable");
  }
  const serviceAccount = JSON.parse(rawServiceAccount);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const BASE_URL = "https://linkhub-three-murex.vercel.app";

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

module.exports = async (req, res) => {
  try {
    // Only published posts belong in the public sitemap; drafts must never be exposed.
    const snapshot = await db.collection("posts").where("status", "==", "published").get();
    const urls = [
      { loc: `${BASE_URL}/`, lastmod: null },
      { loc: `${BASE_URL}/privacypolicy.html`, lastmod: null },
      { loc: `${BASE_URL}/terms.html`, lastmod: null }
    ];

    snapshot.forEach((document) => {
      const post = document.data();
      const slug = post.slug || document.id;
      const url = `${BASE_URL}/blog.html?slug=${encodeURIComponent(slug)}`;
      const timestamp = post.updatedAt || post.createdAt;
      let lastmod = null;
      if (timestamp && typeof timestamp.toDate === "function") {
        lastmod = timestamp.toDate().toISOString().slice(0, 10);
      } else if (timestamp) {
        const date = new Date(timestamp);
        if (!Number.isNaN(date.getTime())) lastmod = date.toISOString().slice(0, 10);
      }
      urls.push({ loc: url, lastmod });
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({loc,lastmod}) => `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    return res.status(500).send("Unable to generate sitemap. Check Firebase service account configuration.");
  }
};
