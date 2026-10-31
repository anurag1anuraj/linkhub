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
// Insert structured HTML at the last selection inside the article editor.
let editorRange = null;
function rememberEditorRange() {
  const selection = window.getSelection();
  if (selection.rangeCount && contentEditor.contains(selection.anchorNode)) editorRange = selection.getRangeAt(0).cloneRange();
}
contentEditor.addEventListener("keyup", rememberEditorRange);
contentEditor.addEventListener("mouseup", rememberEditorRange);
function insertEditorNode(node) {
  contentEditor.focus();
  const selection = window.getSelection();
  const range = editorRange && contentEditor.contains(editorRange.commonAncestorContainer)
    ? editorRange.cloneRange() : document.createRange();
  if (!editorRange || !contentEditor.contains(range.commonAncestorContainer)) {
    range.selectNodeContents(contentEditor);
    range.collapse(false);
  }
  range.deleteContents();
  range.insertNode(node);
  const after = document.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  selection.removeAllRanges();
  selection.addRange(after);
  editorRange = after.cloneRange();
}
const codeDialog = document.querySelector("#code-dialog");
document.querySelector("#insert-code").addEventListener("click", () => {
  rememberEditorRange();
  document.querySelector("#code-input").value = "";
  codeDialog.showModal();
  document.querySelector("#code-input").focus();
});
document.querySelector("#cancel-code").addEventListener("click", () => codeDialog.close());
document.querySelector("#code-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = document.querySelector("#code-input").value;
  if (!value.trim()) return;
  const pre = document.createElement("pre");
  pre.style.cssText = "background:#19232e;color:#f4f7fb;padding:18px;border-radius:10px;overflow-x:auto;white-space:pre;font-size:14px;line-height:1.6;margin:20px 0";
  const code = document.createElement("code");
  code.textContent = value; // textContent prevents executable HTML injection.
  pre.appendChild(code);
  codeDialog.close();
  insertEditorNode(pre);
});
document.querySelector("#insert-table").addEventListener("click", () => {
  rememberEditorRange();
  const rowInput = prompt("Number of rows (including header):", "3");
  if (rowInput === null) return;
  const colInput = prompt("Number of columns:", "3");
  if (colInput === null) return;
  const rows = Number(rowInput), cols = Number(colInput);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 30 || cols > 12) {
    message(postMessage, "Enter 1–30 rows and 1–12 columns.", true);
    return;
  }
  const table = document.createElement("table");
  table.style.cssText = "border-collapse:collapse;width:100%;margin:20px 0";
  for (let r = 0; r < rows; r++) {
    const tr = table.insertRow();
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement(r === 0 ? "th" : "td");
      cell.textContent = r === 0 ? `Heading ${c + 1}` : "Edit text";
      cell.style.cssText = "border:1px solid #cbd5e1;padding:10px 12px;text-align:left;" + (r === 0 ? "background:#f1f5f9;font-weight:700" : "");
      tr.appendChild(cell);
    }
  }
  insertEditorNode(table);
  message(postMessage, "Table inserted. Click any cell to edit its text.");
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
