import { db } from "./firebase.js";
import { collection, doc, getDoc, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { escapeHtml, formatDate, setupMenu } from "./shared.js";

const root = document.querySelector("#article-content");
document.querySelector("#year").textContent = new Date().getFullYear();
setupMenu();

function safeArticleHtml(html = "") {
  const docNode = new DOMParser().parseFromString(html, "text/html");
  docNode.querySelectorAll("script,style,iframe,object,embed,form,svg,math").forEach((node) => node.remove());
  docNode.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name === "src") && value.startsWith("javascript:"))) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return docNode.body.innerHTML;
}

const slug = new URLSearchParams(location.search).get("slug");
if (!slug) {
  root.innerHTML = '<p class="muted">No article was selected. Return to the <a href="index.html">home page</a>.</p>';
} else {
  try {
    let found = null;
    // Resolve the public URL slug first. This avoids a permission-denied direct
    // document read preventing the slug query from running.
    const bySlug = await getDocs(
      query(
        collection(db, "posts"),
        where("slug", "==", slug),
        where("status", "==", "published"),
        limit(1)
      )
    );
    if (!bySlug.empty) {
      found = { id: bySlug.docs[0].id, ...bySlug.docs[0].data() };
    }

    // Fallback for older posts whose document ID is used as the URL.
    if (!found) {
      try {
        const byId = await getDoc(doc(db, "posts", slug));
        if (byId.exists() && byId.data().status === "published") {
          found = { id: byId.id, ...byId.data() };
        }
      } catch (idError) {
        console.debug("Direct article ID lookup was unavailable.", idError);
      }
    }
    if (!found) {
      root.innerHTML = '<p class="muted">This article could not be found or is not published.</p>';
    } else {
      const articleTitle = `${found.title || "Article"} — LinkHub`;
      const description = (found.excerpt || found.title || "Read this story on LinkHub.").replace(/\s+/g, " ").slice(0, 155);
      const canonicalUrl = `${location.origin}${location.pathname}?slug=${encodeURIComponent(found.slug || slug)}`;
      document.title = articleTitle;
      document.querySelector('meta[name="description"]').content = description;
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.href = canonicalUrl;
      const setMeta = (selector, value) => { const element = document.querySelector(selector); if (element) element.setAttribute("content", value); };
      setMeta('meta[property="og:title"]', articleTitle);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[property="og:url"]', canonicalUrl);
      setMeta('meta[name="twitter:title"]', articleTitle);
      setMeta('meta[name="twitter:description"]', description);
      if (found.imageUrl) setMeta('meta[property="og:image"]', found.imageUrl);
      const structuredData = {
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": found.title || "LinkHub article", "description": description,
        "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
        "datePublished": found.createdAt?.toDate ? found.createdAt.toDate().toISOString() : undefined,
        "dateModified": (found.updatedAt?.toDate ? found.updatedAt.toDate().toISOString() : undefined),
        "author": { "@type": "Person", "name": found.author || "LinkHub Editorial" },
        "publisher": { "@type": "Organization", "name": "LinkHub" },
        "image": found.imageUrl || undefined
      };
      let jsonLd = document.querySelector('#article-jsonld');
      if (!jsonLd) { jsonLd = document.createElement('script'); jsonLd.id = 'article-jsonld'; jsonLd.type = 'application/ld+json'; document.head.appendChild(jsonLd); }
      jsonLd.textContent = JSON.stringify(structuredData);
      const image = found.imageUrl ? `<img class="article-cover" src="${escapeHtml(found.imageUrl)}" alt="${escapeHtml(found.title)}" loading="eager">` : "";
      root.innerHTML = `<header class="article-header">
        <div class="post-meta"><span class="category-tag">${escapeHtml(found.category || "Other")}</span><span>${escapeHtml(formatDate(found.createdAt))}</span></div>
        <h1>${escapeHtml(found.title)}</h1>
        ${found.excerpt ? `<p class="article-excerpt">${escapeHtml(found.excerpt)}</p>` : ""}
      </header>${image}<article class="article-content">${safeArticleHtml(found.contentHtml || "")}</article>`;
    }
  } catch (error) {
    console.error(error);
    root.innerHTML = '<p class="muted">Could not load this article. Please check your Firestore rules and connection.</p>';
  }
}
