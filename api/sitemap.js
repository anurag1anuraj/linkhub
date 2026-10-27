const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const BASE_URL = "https://linkhub-three-murex.vercel.app";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

module.exports = async (req, res) => {
  try {
    // Change "blogs" if your Firestore collection has another name.
    const snapshot = await db.collection("posts").get();

    const urls = [
      `${BASE_URL}/`,
      `${BASE_URL}/privacypolicy.html`,
      `${BASE_URL}/terms.html`,
    ];

    snapshot.forEach((doc) => {
      const blog = doc.data();

      // Include only published blogs.
      if (!blog.slug) return;

      const blogUrl =
        `${BASE_URL}/blog.html?slug=` +
        encodeURIComponent(blog.slug);

      urls.push(blogUrl);
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${escapeXml(url)}</loc>
  </url>`).join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    return res.status(500).send("Unable to generate sitemap");
  }
};
