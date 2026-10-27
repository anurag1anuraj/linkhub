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
      document.title = `${found.title} — LinkHub`;
      document.querySelector('meta[name="description"]').content = found.excerpt || found.title;
      const image = found.imageUrl ? `<img class="article-cover" src="${escapeHtml(found.imageUrl)}" alt="${escapeHtml(found.title)}">` : "";
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
