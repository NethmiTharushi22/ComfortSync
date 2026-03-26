# ComfortSync

Minimal full-stack starter with:

- `frontend/`: React + Vite
- `backend/`: FastAPI

## Run

Frontend:

```powershell
cd frontend
& "C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev
```

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Firebase Firestore

1. Create a Firebase project and register a web app in Firebase Console.
2. Enable Firestore Database in test mode for initial development.
3. Copy `frontend/.env.example` to `frontend/.env` and paste your Firebase web app config values.
4. Restart the Vite dev server after saving `.env`.
