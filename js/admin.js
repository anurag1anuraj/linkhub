import { auth, db } from "./firebase.js";
import { ADMIN_UID, escapeHtml, formatDate, plainTextFromHtml, slugify } from "./shared.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const postForm = document.querySelector("#post-form");
const postMessage = document.querySelector("#post-message");
const postList = document.querySelector("#admin-post-list");
const contentEditor = document.querySelector("#post-content");
let postsCache = [];

function message(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}
function resetEditor() {
  postForm.reset();
  document.querySelector("#post-id").value = "";
  contentEditor.innerHTML = "";
  document.querySelector("#editor-heading").textContent = "Write an article";
  message(postMessage, "");
}
function requireAdmin(user) {
  if (!user || user.uid !== ADMIN_UID) {
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    message(loginMessage, "This account does not have admin access. Sign in with the admin account configured for this website.", true);
    return false;
  }
  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");
  message(loginMessage, "");
  loadPosts();
  return true;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  message(loginMessage, "Signing in…");
  try {
    const email = document.querySelector("#login-email").value.trim();
    const password = document.querySelector("#login-password").value;
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);
      message(loginMessage, "Signed in, but this account is not the configured admin account.", true);
      return;
    }
    requireAdmin(result.user);
  } catch (error) {
    message(loginMessage, error.message || "Sign-in failed.", true);
  }
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  await signOut(auth);
  resetEditor();
});
document.querySelector("#reset-editor").addEventListener("click", resetEditor);

async function loadPosts() {
  postList.innerHTML = '<p class="muted">Loading articles…</p>';
  try {
    const snapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
    postsCache = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    document.querySelector("#post-count").textContent = postsCache.length;
    renderAdminPosts();
  } catch (error) {
    postList.innerHTML = '<p class="muted">Could not load posts. Check Firestore rules and browser console.</p>';
    console.error(error);
  }
}
function renderAdminPosts() {
  postList.innerHTML = "";
  if (!postsCache.length) {
    postList.innerHTML = '<p class="muted">No articles yet. Write your first one using the editor.</p>';
    return;
  }
  postsCache.forEach((post) => {
    const item = document.createElement("div");
    item.className = "admin-post-item";
    item.innerHTML = `<h3>${escapeHtml(post.title || "Untitled")}</h3>
      <div class="post-meta"><span>${escapeHtml(post.category || "Other")}</span><span class="${post.status === "published" ? "status-published" : "status-draft"}">${post.status === "published" ? "Published" : "Draft"}</span></div>
      <div class="admin-post-actions">
        <button class="small-button" type="button" data-action="edit" data-id="${escapeHtml(post.id)}">Edit</button>
        <button class="small-button" type="button" data-action="toggle" data-id="${escapeHtml(post.id)}">${post.status === "published" ? "Unpublish" : "Publish"}</button>
        <button class="small-button danger" type="button" data-action="delete" data-id="${escapeHtml(post.id)}">Delete</button>
      </div>`;
    postList.appendChild(item);
  });
}
postList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const post = postsCache.find((item) => item.id === button.dataset.id);
  if (!post) return;
  if (button.dataset.action === "edit") {
    document.querySelector("#post-id").value = post.id;
    document.querySelector("#post-title").value = post.title || "";
    document.querySelector("#post-category").value = post.category || "Other";
    document.querySelector("#post-status").value = post.status || "draft";
    document.querySelector("#post-image").value = post.imageUrl || "";
    document.querySelector("#post-excerpt").value = post.excerpt || "";
    contentEditor.innerHTML = post.contentHtml || "";
    document.querySelector("#editor-heading").textContent = "Edit article";
    message(postMessage, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (button.dataset.action === "toggle") {
    const nextStatus = post.status === "published" ? "draft" : "published";
    try {
      await updateDoc(doc(db, "posts", post.id), { status: nextStatus, updatedAt: serverTimestamp() });
      await loadPosts();
    } catch (error) {
      message(postMessage, error.message, true);
    }
  } else if (button.dataset.action === "delete") {
    if (!confirm(`Delete "${post.title}" permanently?`)) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
      await loadPosts();
      if (document.querySelector("#post-id").value === post.id) resetEditor();
    } catch (error) {
      message(postMessage, error.message, true);
    }
  }
});

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user || user.uid !== ADMIN_UID) {
    message(postMessage, "Admin access is required.", true);
    return;
  }
  const title = document.querySelector("#post-title").value.trim();
  const category = document.querySelector("#post-category").value;
  const status = document.querySelector("#post-status").value;
  const imageUrl = document.querySelector("#post-image").value.trim();
  const excerpt = document.querySelector("#post-excerpt").value.trim();
  const contentHtml = contentEditor.innerHTML.trim();
  const contentText = plainTextFromHtml(contentHtml);
  if (!title || !contentText) {
    message(postMessage, "Please add a title and article content.", true);
    return;
  }
  const postId = document.querySelector("#post-id").value;
  const data = {
    title, slug: slugify(title), category, status, imageUrl, excerpt, contentHtml,
    updatedAt: serverTimestamp()
  };
  message(postMessage, "Saving article…");
  try {
    if (postId) {
      await updateDoc(doc(db, "posts", postId), data);
      message(postMessage, "Article updated.");
    } else {
      await addDoc(collection(db, "posts"), { ...data, createdAt: serverTimestamp(), authorUid: user.uid });
      message(postMessage, "Article saved.");
    }
    resetEditor();
    message(postMessage, "Article saved successfully.");
    await loadPosts();
  } catch (error) {
    message(postMessage, error.message || "Could not save article.", true);
    console.error(error);
  }
});

document.querySelectorAll(".editor-toolbar [data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    contentEditor.focus();
    const command = button.dataset.command;
    const value = button.dataset.value || null;
    document.execCommand(command, false, value);
  });
});
document.querySelector("#insert-link").addEventListener("click", () => {
  const url = prompt("Enter the full link URL (https://…):");
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) {
    message(postMessage, "Please use a full http:// or https:// URL.", true);
    return;
  }
  contentEditor.focus();
  document.execCommand("createLink", false, url);
});
document.querySelector("#insert-image").addEventListener("click", () => {
  const url = prompt("Enter the image URL (https://…):");
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) {
    message(postMessage, "Please use a full http:// or https:// image URL.", true);
    return;
  }
  contentEditor.focus();
  document.execCommand("insertImage", false, url);
});
document.querySelector("#preview-post").addEventListener("click", () => {
  const title = document.querySelector("#post-title").value.trim() || "Article preview";
  const excerpt = document.querySelector("#post-excerpt").value.trim();
  const content = contentEditor.innerHTML || "<p>Start writing to preview your article.</p>";
  const preview = window.open("", "_blank", "noopener,noreferrer");
  if (!preview) {
    message(postMessage, "Your browser blocked the preview window. Allow pop-ups and try again.", true);
    return;
  }
  preview.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — LinkHub preview</title><link rel="stylesheet" href="${new URL("css/style.css", location.href).href}"></head><body><main class="article-main"><p class="preview-note">Preview only — not published</p><header class="article-header"><h1>${escapeHtml(title)}</h1><p class="article-excerpt">${escapeHtml(excerpt)}</p></header><article class="article-content">${content}</article></main></body></html>`);
  preview.document.close();
});

onAuthStateChanged(auth, (user) => {
  if (user) requireAdmin(user);
  else {
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  }
});
