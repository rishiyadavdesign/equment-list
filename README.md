# Equipment List

Frontend: static HTML/CSS/JS for Vercel.

Backend: Node/Express API in `backend/` for Render.

For local frontend testing, `config.js` keeps `window.EQUIPMENT_API_URL` empty and the app uses browser storage. After deploying the backend on Render, update `config.js` with the Render URL.

For production data, set `MONGODB_URI` in Render. If `MONGODB_URI` is empty, the backend falls back to local JSON storage for development/testing.

## Step 1: Push this folder to GitHub

Create a GitHub repository and push this project.

## Step 2: Deploy backend on Render

1. Go to Render Dashboard.
2. Create a new Web Service from the GitHub repository.
3. Use these settings:
   - Root Directory: `backend`
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/health`
4. Add environment variables:
   - `MONGODB_URI=<your MongoDB Atlas connection string>`
   - `MONGODB_DB=equipment_list`
   - `MONGODB_COLLECTION=assignments`
   - `FRONTEND_ORIGIN=*`
5. Deploy and copy the backend URL, for example `https://equipment-list-api.onrender.com`.

## MongoDB Atlas setup

1. Create a free MongoDB Atlas cluster.
2. Create a database user with a password.
3. In Network Access, allow Render to connect. For quick setup, add `0.0.0.0/0`.
4. Copy the connection string.
5. Replace `<password>` in the string with your database user password.
6. Add that full string to Render as `MONGODB_URI`.

Example:

```text
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

## Step 3: Connect frontend to backend

Open `config.js` and set:

```js
window.EQUIPMENT_API_URL = "https://your-render-backend-url.onrender.com";
```

Commit and push that change.

## Step 4: Deploy frontend on Vercel

1. Go to Vercel Dashboard.
2. Import the same GitHub repository.
3. Use the project root as the frontend root.
4. No build command is needed for this static site.
5. Deploy.

## Local testing

Frontend only:

```bash
python3 -m http.server 4173
```

Backend:

```bash
cd backend
npm install
npm start
```
