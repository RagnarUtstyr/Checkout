# Rental Equipment Tracker

A GitHub Pages hosted React app that uses Firebase Authentication and Cloud Firestore for bookings, checkouts, and check-ins.

## What this version does

- GitHub hosts the frontend with **GitHub Pages**
- The page reads and writes data directly to **Firebase**
- Users sign in with **Google** or **email/password** using Firebase Authentication
- No local install is required for deployment if you push through GitHub

## Important setup you already have most of

In Firebase, make sure all of these are enabled:

- Authentication → **Google**
- Authentication → **Email/Password**
- Firestore database

## One extra Firebase step for GitHub Pages login

Add your GitHub Pages domain to **Authentication → Settings → Authorized domains**.

For a GitHub Pages site like:

- `https://YOUR-USERNAME.github.io/YOUR-REPO/`

add this domain:

- `YOUR-USERNAME.github.io`

That domain authorization matters for Firebase Auth on web apps.

## How to publish from GitHub without installing anything locally

1. Create a GitHub repository.
2. Upload all project files to the repository.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Push to the `main` branch.
6. GitHub Actions will install dependencies, build the app, and publish it.

The workflow file is already included here:

- `.github/workflows/deploy.yml`

## Routing for GitHub Pages

This app uses `HashRouter`, so the URLs look like:

- `/#/`
- `/#/booking`
- `/#/checkout`
- `/#/checkin`

That avoids refresh and deep-link issues on GitHub Pages.

## Firebase config

The app is preconfigured for:

- Project ID: `checkout-52442`
- Auth domain: `checkout-52442.firebaseapp.com`

The Firebase web config is embedded in the client app as a fallback and can also be overridden with Vite env vars later if you want. For Firebase web apps, the API key is not treated as a secret in the same way as a server credential; your real protection is Firebase Auth plus Firestore Security Rules.

## Suggested Firestore collections

- `equipment` — equipment catalog
- `rentals` — bookings/checkouts/check-ins

## Suggested equipment document

```json
{
  "name": "Sony A7 IV",
  "category": "Camera",
  "serialNumber": "A7IV-0021",
  "barcode": "1000021",
  "isActive": true,
  "notes": "Main body only"
}
```

## Starter Firestore rules

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Good next upgrades

- equipment admin page
- overdue highlighting
- edit booking flow
- better stock availability checks
- barcode scanning


## GitHub Actions build note

This project is configured to deploy from GitHub Pages without requiring a committed `package-lock.json`. The workflow uses `npm install` instead of `npm ci`, so your repository can build on GitHub even if you have not generated a lockfile locally yet.


## GitHub Pages for this repo

This repo is configured for deployment at:

`https://ragnarutstyr.github.io/Checkout/#/`

If you rename the repository, update `vite.config.js` so the `base` value matches the repo path.


## Stability note
This version includes a client-side error boundary so runtime errors show a message on-screen instead of a blank page.
