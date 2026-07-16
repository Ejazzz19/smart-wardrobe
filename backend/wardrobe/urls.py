from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ClothingItemViewSet, OutfitSuggestionView, WornLogListCreateView

router = DefaultRouter()
router.register(r"items", ClothingItemViewSet, basename="clothingitem")

urlpatterns = [
    path("", include(router.urls)),
    path("outfits/suggest/", OutfitSuggestionView.as_view(), name="outfit-suggest"),
    path("outfits/history/", WornLogListCreateView.as_view(), name="outfit-history"),
    path("outfits/worn/", WornLogListCreateView.as_view(), name="outfit-worn"),
]
