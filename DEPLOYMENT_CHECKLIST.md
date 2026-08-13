# Deployment checklist

## 1. Local backend
- [ ] `cd backend`
- [ ] Create Python venv
- [ ] `pip install -r requirements.txt`
- [ ] `python seed.py`
- [ ] `uvicorn main:app --reload --port 8000`
- [ ] Open `/docs`
- [ ] Confirm `/health`

## 2. Local frontend
- [ ] `cd frontend`
- [ ] `npm install`
- [ ] Copy `.env.example` to `.env.local`
- [ ] `npm run dev`
- [ ] Login as `alice` with OTP `123456`
- [ ] Open a second browser/incognito window and login as `bob`
- [ ] Send messages in both directions
- [ ] Test typing indicator
- [ ] Test group
- [ ] Test settings/theme
- [ ] Test logout/login persistence

## 3. GitHub
- [ ] Create a public repository
- [ ] Never commit `.env`, tokens or database secrets
- [ ] `git add .`
- [ ] `git commit -m "feat: complete secure messaging platform"`
- [ ] `git push -u origin main`

## 4. Render backend
- [ ] New Web Service
- [ ] Root directory: `backend`
- [ ] Build: `pip install -r requirements.txt`
- [ ] Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- [ ] `JWT_SECRET`: generated secret
- [ ] `FRONTEND_URL`: Vercel URL after frontend exists
- [ ] Open `https://YOUR-BACKEND.onrender.com/health`
- [ ] Confirm WebSocket uses `wss://`

## 5. Vercel frontend
- [ ] Import the GitHub repository
- [ ] Root directory: `frontend`
- [ ] `NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.onrender.com`
- [ ] `NEXT_PUBLIC_WS_URL=wss://YOUR-BACKEND.onrender.com`
- [ ] Deploy
- [ ] Update Render `FRONTEND_URL` to the final Vercel URL
- [ ] Redeploy backend

## 6. Final evaluation test
- [ ] Login demo user
- [ ] New chat
- [ ] Send message
- [ ] Check real-time delivery in second browser
- [ ] Open chat and confirm read state
- [ ] Create group
- [ ] Add/remove member
- [ ] Refresh browser and confirm session persists
- [ ] Toggle dark mode
- [ ] Verify `/docs`
