from django.db.models import Count
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ClothingItem, WornLog
from .serializers import ClothingItemSerializer, WornLogSerializer
from .services import get_current_weather, suggest_outfit, temp_to_season, upload_clothing_image


class ClothingItemViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for a user's clothing items, scoped to the logged-in user.
    Supports ?category=&color=&season=&occasion= filtering via query params.
    """

    serializer_class = ClothingItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ClothingItem.objects.filter(owner=self.request.user)
        for field in ("category", "color", "season", "occasion"):
            value = self.request.query_params.get(field)
            if value:
                qs = qs.filter(**{field: value})
        return qs

    def perform_create(self, serializer):
        image_file = serializer.validated_data.pop("image", None)
        image_url = upload_clothing_image(image_file) if image_file else ""
        serializer.save(owner=self.request.user, image_url=image_url)

    def perform_update(self, serializer):
        image_file = serializer.validated_data.pop("image", None)
        if image_file:
            serializer.save(image_url=upload_clothing_image(image_file))
        else:
            serializer.save()

    @action(detail=False, methods=["get"], url_path="least-worn")
    def least_worn(self, request):
        """GET /api/items/least-worn/ - items sorted by fewest times worn."""
        qs = (
            self.get_queryset()
            .annotate(worn_count=Count("worn_logs"))
            .order_by("worn_count", "-created_at")[:10]
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class OutfitSuggestionView(APIView):
    """
    GET /api/outfits/suggest/?occasion=casual&lat=..&lon=..
    Looks up live weather for the given coordinates, buckets it into a
    season, then applies the rule-based matcher. If lat/lon are omitted,
    defaults to a mild season so the endpoint still works without location.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        occasion = request.query_params.get("occasion", "any")
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")

        weather = None
        if lat and lon:
            try:
                weather = get_current_weather(float(lat), float(lon))
            except Exception:
                weather = None  # fall back below rather than failing the request

        season = temp_to_season(weather["temp_c"]) if weather else "mild"

        outfit = suggest_outfit(request.user, season=season, occasion=occasion)
        serialized = {
            key: ClothingItemSerializer(item).data if item else None
            for key, item in outfit.items()
        }
        return Response(
            {
                "season_used": season,
                "weather": weather,
                "occasion": occasion,
                "outfit": serialized,
            }
        )


class WornLogListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/outfits/history/ - wear history log
    POST /api/outfits/worn/   - log an outfit as worn (see urls.py for the split)
    """

    serializer_class = WornLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WornLog.objects.filter(owner=self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
