import { db } from "./firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { escapeHtml, formatDate, setupMenu } from "./shared.js";

const grid = document.querySelector("#posts-grid");
const empty = document.querySelector("#empty-state");
const clearFilter = document.querySelector("#clear-filter");
const searchInput = document.querySelector("#site-search");
const sortSelect = document.querySelector("#sort-posts");
const countLabel = document.querySelector("#results-count");
const pagination = document.querySelector("#pagination");
const pageSize = 9;
let allPosts = [], activeCategory = "All", currentPage = 1, searchTerm = "";
document.querySelector("#year").textContent = new Date().getFullYear();
setupMenu();

function postUrl(post) { return `blog.html?slug=${encodeURIComponent(post.slug || post.id)}`; }
function imageMarkup(post) {
  return post.imageUrl
    ? `<img src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.title)}" loading="lazy" onerror="this.parentElement.classList.add('no-image');this.remove()">`
    : `<div class="card-image-fallback"><span>LINKHUB</span><i>↗</i></div>`;
}
function dateValue(post) { return post.createdAt?.toMillis ? post.createdAt.toMillis() : new Date(post.createdAt || 0).getTime(); }
function getFilteredPosts() {
  let posts = [...allPosts];
  if (activeCategory !== "All") posts = posts.filter(p => (p.category || "Article").toLowerCase() === activeCategory.toLowerCase());
  if (searchTerm) posts = posts.filter(p => `${p.title || ""} ${p.excerpt || ""} ${p.category || ""} ${p.content || ""}`.toLowerCase().includes(searchTerm));
  if (sortSelect.value === "oldest") posts.sort((a,b) => dateValue(a)-dateValue(b));
  else if (sortSelect.value === "title") posts.sort((a,b) => (a.title||"").localeCompare(b.title||""));
  else posts.sort((a,b) => dateValue(b)-dateValue(a));
  return posts;
}
function renderPagination(total) {
  pagination.innerHTML = ""; const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return;
  const add = (label, page, disabled = false, active = false) => {
    const b = document.createElement("button"); b.textContent = label; b.disabled = disabled; if(active) b.className = "page-current";
    b.addEventListener("click", () => { currentPage = page; render(); document.querySelector("#blog").scrollIntoView({behavior:"smooth", block:"start"}); }); pagination.appendChild(b);
  };
  add("←", currentPage-1, currentPage===1);
  for(let p=1;p<=pages;p++) add(String(p),p,false,p===currentPage);
  add("→",currentPage+1,currentPage===pages);
}
function render() {
  const posts = getFilteredPosts(); const pages = Math.max(1,Math.ceil(posts.length/pageSize)); currentPage = Math.min(currentPage,pages);
  const visible = posts.slice((currentPage-1)*pageSize,currentPage*pageSize);
  grid.innerHTML = ""; empty.classList.toggle("hidden", posts.length > 0); grid.classList.toggle("hidden", posts.length === 0);
  countLabel.textContent = `${posts.length} ${posts.length === 1 ? "story" : "stories"}${activeCategory !== "All" ? ` in ${activeCategory}` : " to explore"}`;
  clearFilter.classList.toggle("hidden", activeCategory === "All" && !searchTerm);
  visible.forEach((post,index) => {
    const card = document.createElement("article"); card.className = "article-card";
    card.innerHTML = `<a class="article-image" href="${postUrl(post)}">${imageMarkup(post)}<span class="image-category">${escapeHtml(post.category || "Article")}</span><span class="image-arrow">↗</span></a><div class="article-card-body"><div class="article-meta"><time>${escapeHtml(formatDate(post.createdAt))}</time><span>•</span><span>${escapeHtml(post.readTime || "5 min read")}</span></div><h3><a href="${postUrl(post)}">${escapeHtml(post.title || "Untitled article")}</a></h3><p>${escapeHtml(post.excerpt || "Explore this story on LinkHub.")}</p><a class="author-link" href="${postUrl(post)}"><span class="author-avatar">${escapeHtml((post.author || "L").trim().charAt(0).toUpperCase())}</span><span>${escapeHtml(post.author || "LinkHub Editorial")}</span><span class="author-arrow">↗</span></a></div>`;
    grid.appendChild(card);
  });
  renderPagination(posts.length);
}
function setCategory(category) {
  activeCategory = category; currentPage = 1;
  document.querySelectorAll("[data-category]").forEach(b => b.classList.toggle("selected", b.dataset.category === category));
  render();
}
document.querySelectorAll("[data-category]").forEach(b => b.addEventListener("click", () => setCategory(b.dataset.category)));
document.querySelectorAll("[data-nav-category]").forEach(a => a.addEventListener("click", () => setCategory(a.dataset.navCategory)));
document.querySelectorAll("[data-topic]").forEach(a => a.addEventListener("click", () => setCategory(a.dataset.topic)));
const searchBox = document.querySelector(".search-box");
const searchToggle = document.querySelector(".search-toggle");

searchToggle.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  searchBox.classList.toggle("search-open");

  if (searchBox.classList.contains("search-open")) {
    searchInput.focus();
  }
});
searchInput.addEventListener("input", () => { searchTerm = searchInput.value.trim().toLowerCase(); currentPage = 1; render(); });
sortSelect.addEventListener("change", () => { currentPage = 1; render(); });
clearFilter.addEventListener("click", () => { searchInput.value = ""; searchTerm = ""; setCategory("All"); });
try {
  const postsQuery = query(collection(db, "posts"), where("status", "==", "published"));
  const snapshot = await getDocs(postsQuery);
  allPosts = snapshot.docs.map(doc => ({id:doc.id,...doc.data()}));
  allPosts.sort((a,b)=>dateValue(b)-dateValue(a));
  render();
} catch(error) {
  grid.innerHTML = `<div class="load-error"><strong>Stories couldn’t load.</strong><p>Please check your internet connection and Firestore published-post read rules.</p></div>`;
  console.error("LinkHub articles failed to load:",error);
}
