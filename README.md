# TraceIP · Cloud & GitHub Pages Edition

TraceIP is a consent-based network and device visibility education lab. It demonstrates what public network address and device information is shared with a web application when a visitor explicitly authorizes a test.

---

## What the Lab Records

When a visitor checks the consent box and starts an authorized test, the app records:

- **Network IP:** The public IPv4 or IPv6 address visible to the application
- **Device Model:** e.g. *Apple iPhone*, *Apple iPad*, *Samsung Galaxy*, *Windows PC*, *Apple Mac*
- **Operating System:** e.g. *iOS 17.5*, *Android 14*, *Windows 11*, *macOS Sonoma*
- **Browser:** e.g. *Chrome 124*, *Safari 17*, *Edge*, *Firefox*
- **Screen & Hardware:** Screen resolution and device type (*Mobile / Tablet / Desktop*)
- **Custom Device Label:** Optional user-provided label (e.g. *"Lab-Laptop-1"*, *"John's Phone"*)
- **UTC Timestamp:** Accurate ISO timestamp of the authorized test

---

## Live Deployment on GitHub Pages

This project is ready to be hosted 100% on **GitHub Pages** for free, using **Firebase Firestore** as the cloud database.

### Step 1: Set up Firebase Firestore (2 minutes, Free)

1. Go to the [Firebase Console](https://console.firebase.google.com) and click **Create a project**.
2. Go to **Build** → **Firestore Database** → click **Create database**.
3. Choose your database location and select **Start in test mode** (or configure security rules allowing read/write on `ip_logs`).
4. In Project Overview, click the **Web icon (</>)** to register a web app.
5. Copy the `firebaseConfig` object and paste it into [`firebase-config.js`](file:///d:/project/demo/firebase-config.js):

```javascript
export const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Set your private admin dashboard password here:
export const ADMIN_PASSWORD = "your-secure-password";
```

### Step 2: Push to GitHub & Enable GitHub Pages

1. Initialize Git and commit the files (if not already done):
   ```powershell
   git init
   git add .
   git commit -m "Deploy TraceIP to GitHub Pages with Firebase"
   ```
2. Create a repository on [GitHub](https://github.com/new) and push your code:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```
3. On your GitHub repository page:
   - Go to **Settings** → **Pages** (under Code and automation in the left menu).
   - Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
   - Under **Branch**, select `main` and folder `/ (root)`, then click **Save**.
4. In about 1 minute, GitHub will give you your live URL:
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO/
   ```

---

## Dashboard Access

To view, search, and manage your recorded logs:
* Open `https://YOUR_USERNAME.github.io/YOUR_REPO/admin.html`
* Enter the password configured in `firebase-config.js` (`ADMIN_PASSWORD`).
* View real-time logs with:
  - Live search by IP, device model, or date
  - Device type badges (Mobile, Desktop, Tablet)
  - Custom device labels
  - Total tests and mobile/desktop breakdown
  - Individual log deletion and bulk "Delete all logs" button

---

## Local Testing

You can also run this locally using any static web server:

```powershell
# Using npx serve:
npx serve .

# Or using Node:
npm test
```

Then open `http://localhost:3000` (or the port indicated).
