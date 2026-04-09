# Rental Equipment Tracker — GitHub Pages + Firebase

This version is a **no-build** app for GitHub Pages.

## What it uses
- **GitHub Pages** for hosting static files
- **Firebase Authentication** for login
- **Cloud Firestore** for bookings, checkouts, check-ins, and equipment
- **Firebase Web SDK via CDN browser modules**

## Why this version exists
This avoids Vite / React / GitHub Actions build issues.
You can upload these files directly to GitHub and publish them with GitHub Pages.

## How to publish
1. Put these files in the root of your `Checkout` repo.
2. In GitHub repo settings, open **Pages**.
3. Set the source to **Deploy from a branch**.
4. Choose branch `main` and folder `/ (root)`.
5. Save.

Your site URL should be:
`https://ragnarutstyr.github.io/Checkout/`

## Firebase checklist
In Firebase Console:
- Authentication → enable **Google**
- Authentication → enable **Email/Password**
- Authentication → Settings → **Authorized domains** → add `ragnarutstyr.github.io`
- Firestore Database → create the database
- Firestore Security Rules → update rules so signed-in users can read/write

## Collections used
### `equipment`
Each document is one physical item/unit.

Example:
```json
{
  "name": "C-Stand",
  "type": "Grip",
  "unitNumber": 3,
  "displayName": "C-Stand #3",
  "groupKey": "grip__c-stand",
  "manufacturer": "Avenger",
  "model": "A2033",
  "status": "available"
}
```

### `rentals`
Each document is one booking / rental record.

## Included pages
- Overview
- Booking
- Checkout
- Check-in
- Equipment

## XML import
The XML importer supports common field names such as:
- `name`
- `type`
- `amount`
- `quantity`
- `manufacturer`
- `model`
- `description`
- `notes`

If your XML format is different, send a sample and it can be adapted.
