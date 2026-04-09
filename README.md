# Rental Equipment Tracker

A Firebase-backed React app for managing bookings, checkouts, and check-ins of rental equipment.

## Features

- Login with Google or email/password
- Dashboard with active bookings and current checkouts
- Booking creation with renter details and equipment list
- Checkout workflow with pick/confirm equipment items
- Check-in workflow to mark returned equipment
- Firestore-backed records with timestamps and status history

## Tech stack

- React + Vite
- Firebase Authentication
- Cloud Firestore

## Setup

1. Create a Firebase project.
2. Enable **Authentication**:
   - Google provider
   - Email/Password provider
3. Create a **Cloud Firestore** database in production or test mode.
4. Your Firebase config has already been filled into `.env` and `.env.example` for project `checkout-52442`.
5. Install dependencies:

   ```bash
   npm install
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

## Suggested Firestore collections

- `equipment` — equipment catalog
- `rentals` — bookings/checkouts/check-ins

## Suggested seed data for equipment

Each `equipment` document can look like:

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

## Firestore security rules starter

Adjust to your needs:

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

## Notes

This starter is designed so we can continue iterating together. Good next steps:

- Add equipment availability validation
- Add barcode scanning
- Add printable checkout/check-in sheets
- Add roles/admin controls
- Add search filters and overdue highlighting


## Current Firebase project

This starter is preconfigured for:

- Project ID: `checkout-52442`
- Auth domain: `checkout-52442.firebaseapp.com`

You still need to enable Google sign-in, Email/Password sign-in, and create Firestore in the Firebase console.
