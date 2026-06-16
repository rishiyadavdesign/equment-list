# Equipment List

Frontend: static HTML/CSS/JS for Vercel.

Backend: Node/Express API in `backend/` for Render.

For local frontend testing, `config.js` keeps `window.EQUIPMENT_API_URL` empty and the app uses browser storage. After deploying the backend on Render, update `config.js` with the Render URL.

For production data on Render, add a persistent disk mounted at `/var/data`, because the backend writes `equipment.json` there when `DATA_DIR=/var/data`.

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
   - `DATA_DIR=/var/data`
   - `FRONTEND_ORIGIN=*`
5. For real saved data, add a persistent disk mounted at `/var/data`.
6. Deploy and copy the backend URL, for example `https://equipment-list-api.onrender.com`.

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
