# LinkHub Blog Website

A static multi-topic blog built with HTML, CSS, JavaScript modules, Firebase Authentication and Cloud Firestore.

## Files

- `index.html` — public homepage and category filters
- `blog.html` — article detail page
- `admin.html` — sign-in and content management
- `css/style.css` — responsive styling
- `js/firebase.js` — Firebase project config and SDK setup
- `js/main.js` — public article listing
- `js/blog.js` — published article detail
- `js/admin.js` — admin sign-in, editor, CRUD and publish/draft
- `firestore.rules` — the intended Firestore security rules

## Before running

1. In Firebase Console, open Authentication → Sign-in method and enable Email/Password.
2. Create the admin user. Its UID must match the `ADMIN_UID` in `js/shared.js` and the UID in `firestore.rules`.
3. Firestore Database should be created in Production mode.
4. Publish the rules from `firestore.rules` in Firestore → Rules.
5. Serve this folder through a local web server or deploy it to a static host. Do not open the HTML files directly with `file://`, because browser ES modules need HTTP.
   - VS Code: install/use Live Server, then open `index.html`.
   - Or deploy to Firebase Hosting / another static host.

## Firebase notes

- The public homepage queries only posts with `status == "published"`.
- Admin access is checked in the UI and enforced by Firestore rules.
- This version uses image URLs; it does not upload files to Firebase Storage.
- The blog detail page uses `blog.html?slug=...`, so each article has a shareable URL. For stronger SEO with pre-rendered per-article metadata, a static-generation or server-rendering step is needed.
- Firestore security rules protect the database. Never replace them with public write access.
- Firebase web config is client-side configuration, not an admin secret. Do not publish service-account private keys or passwords.
- If you change the admin Firebase user, update the UID in both `js/shared.js` and `firestore.rules`, then republish the rules.
