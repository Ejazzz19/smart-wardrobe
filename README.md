# Smart Wardrobe

Catalog your clothes, get outfit suggestions based on live weather + occasion, and track what you actually wear.

## Stack
- Backend: Django + Django REST Framework, JWT auth (`djangorestframework-simplejwt`)
- Database: SQLite locally, PostgreSQL in production (`DATABASE_URL` env var)
- Image storage: Cloudinary
- Weather: Open-Meteo (no API key required)
- Frontend: vanilla HTML/CSS/JS

## Local setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in Cloudinary keys if testing photo upload
python manage.py migrate
python manage.py runserver
```

API will be at `http://127.0.0.1:8000/api/`. Health check: `GET /api/health/`.

## Environment variables

See `backend/.env.example`. Required for full functionality:
- `DJANGO_SECRET_KEY` - any random string locally
- `DATABASE_URL` - leave blank for local SQLite; set for Postgres in production
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - from cloudinary.com dashboard, needed for photo upload to work

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register/` | Create user |
| POST | `/api/auth/login/` | Get JWT access + refresh token |
| POST | `/api/auth/refresh/` | Refresh access token |
| POST | `/api/auth/logout/` | Blacklist refresh token |
| GET/POST | `/api/items/` | List / add clothing items |
| GET/PATCH/DELETE | `/api/items/{id}/` | Item detail / edit / delete |
| GET | `/api/items/least-worn/` | Neglected items |
| GET | `/api/outfits/suggest/` | Rule-based outfit suggestion |
| GET/POST | `/api/outfits/history/` | Wear history log |
