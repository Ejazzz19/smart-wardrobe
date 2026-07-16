"""
Service-layer helpers, kept separate from views so the business logic
(image upload, weather lookup, outfit-matching rules) is easy to test
and reuse independently of the HTTP layer.
"""
import cloudinary
import cloudinary.uploader
import requests
from django.conf import settings

_cloudinary_configured = False


def _ensure_cloudinary_configured():
    global _cloudinary_configured
    if not _cloudinary_configured:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        _cloudinary_configured = True


def upload_clothing_image(file_obj) -> str:
    """Upload an image file to Cloudinary and return its hosted URL."""
    _ensure_cloudinary_configured()
    result = cloudinary.uploader.upload(file_obj, folder="smart-wardrobe")
    return result["secure_url"]


def get_current_weather(latitude: float, longitude: float) -> dict:
    """
    Fetch current temperature (Celsius) and conditions from Open-Meteo.
    Returns a dict like {"temp_c": 22.5, "is_day": 1, "weather_code": 3}.
    Raises requests.RequestException on network/API failure - callers
    should handle that and fall back gracefully.
    """
    response = requests.get(
        settings.OPEN_METEO_BASE_URL,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,is_day,weather_code",
        },
        timeout=5,
    )
    response.raise_for_status()
    data = response.json()["current"]
    return {
        "temp_c": data["temperature_2m"],
        "is_day": data["is_day"],
        "weather_code": data["weather_code"],
    }


def temp_to_season(temp_c: float) -> str:
    """Map a temperature in Celsius to our season buckets."""
    if temp_c >= 24:
        return "hot"
    if temp_c >= 12:
        return "mild"
    return "cold"


def suggest_outfit(user, season: str, occasion: str):
    """
    Rule-based v1 suggestion: pick the least-worn matching item per
    category so neglected pieces surface first. A season/occasion of
    "any" on an item always matches, regardless of the requested filter.

    Returns a dict of {category: ClothingItem|None}. Categories with no
    matching item come back as None so the frontend can show a gap
    ("you have no matching shoes") instead of silently omitting it.
    """
    from django.db.models import Count

    from .models import ClothingItem

    def pick_best(category):
        candidates = ClothingItem.objects.filter(owner=user, category=category)
        if season != "any":
            candidates = candidates.filter(season__in=[season, "any"])
        if occasion != "any":
            candidates = candidates.filter(occasion__in=[occasion, "any"])
        candidates = candidates.annotate(worn_count=Count("worn_logs")).order_by(
            "worn_count", "-created_at"
        )
        return candidates.first()

    dress = pick_best("dress")
    if dress:
        # A dress stands in for top+bottom.
        outfit = {"dress": dress, "top": None, "bottom": None}
    else:
        outfit = {"dress": None, "top": pick_best("top"), "bottom": pick_best("bottom")}

    outfit["outerwear"] = pick_best("outerwear") if season == "cold" else None
    outfit["shoes"] = pick_best("shoes")
    outfit["accessory"] = pick_best("accessory")
    return outfit
