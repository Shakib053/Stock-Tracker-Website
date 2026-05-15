# Stock Profit Tracker

A private stock tracking dashboard built with React, Vite, Tailwind CSS, Firebase Authentication, and Firestore. Visitors must sign in with Google before they can view or manage any stock records.

## Features

- Add, edit, and delete stock entries with modal forms
- Auto-calculate commission, minimum selling price, profit percentage, and total amount
- View summary cards for total stocks, investment, and profit/loss
- Keep records private per signed-in user with Firestore security rules
- Sign in with Google using Firebase Authentication
- Responsive dark-themed UI for mobile, tablet, and desktop
- Netlify-ready configuration with `dist` as the publish directory

## Tech Stack

- React
- Vite
- Tailwind CSS
- Firebase Authentication
- Firestore
- Netlify

## Getting Started

1. Install Node.js from https://nodejs.org/
2. Create a Firebase project.
3. In Firebase Authentication, enable the `Google` sign-in provider.
4. In Firestore Database, create a database in production or test mode.
5. Apply the rules from [`firestore.rules`](./firestore.rules) so each user can only access their own data.
6. Copy `.env.example` to `.env` and fill in your Firebase web app values.
7. Run:

```bash
npm install
npm run dev
```

8. Open the local URL shown in the terminal and sign in with Google.

## Environment Variables

Create a `.env` file with:

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## Firestore Data Shape

Each signed-in user stores records under:

```text
users/{uid}/stocks/{stockId}
```

This means your records are private to your own Firebase account unless you later decide to allow more users.

## Production Build

```bash
npm run build
```

The production files will be created in `dist`.

## Netlify Deployment

Use these settings in Netlify:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: add every `VITE_FIREBASE_*` variable from `.env`

You can also connect the repo directly because `netlify.toml` is already included.

## Firebase Setup Notes

- Add your Netlify site domain to Firebase Authentication authorized domains before testing production sign-in.
- The Firebase config values are safe to expose in the frontend. Privacy comes from Authentication and Firestore security rules.
- If you want only your own Google account to use the app, keep the app URL private and only sign in with your account. For stricter control, you can additionally check `user.email` in the UI or move to custom claims later.
