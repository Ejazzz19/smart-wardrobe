from django.conf import settings
from django.db import models


class ClothingItem(models.Model):
    """A single piece of clothing owned by a user."""

    CATEGORY_CHOICES = [
        ("top", "Top"),
        ("bottom", "Bottom"),
        ("dress", "Dress"),
        ("outerwear", "Outerwear"),
        ("shoes", "Shoes"),
        ("accessory", "Accessory"),
    ]

    SEASON_CHOICES = [
        ("hot", "Hot"),
        ("mild", "Mild"),
        ("cold", "Cold"),
        ("any", "Any"),
    ]

    OCCASION_CHOICES = [
        ("casual", "Casual"),
        ("formal", "Formal"),
        ("work", "Work"),
        ("sport", "Sport"),
        ("any", "Any"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="clothing_items"
    )
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    color = models.CharField(max_length=40, blank=True)
    season = models.CharField(max_length=10, choices=SEASON_CHOICES, default="any")
    occasion = models.CharField(max_length=10, choices=OCCASION_CHOICES, default="any")
    image_url = models.URLField(blank=True)  # Cloudinary-hosted URL
    price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.category})"


class WornLog(models.Model):
    """Records that a set of clothing items was worn together on a given date."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="worn_logs"
    )
    items = models.ManyToManyField(ClothingItem, related_name="worn_logs")
    worn_on = models.DateField()
    occasion = models.CharField(max_length=10, choices=ClothingItem.OCCASION_CHOICES, default="any")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-worn_on"]

    def __str__(self):
        return f"Worn on {self.worn_on} by {self.owner}"
