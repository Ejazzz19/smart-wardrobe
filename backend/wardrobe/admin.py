from django.contrib import admin

from .models import ClothingItem, WornLog


@admin.register(ClothingItem)
class ClothingItemAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "category", "color", "season", "occasion", "created_at")
    list_filter = ("category", "season", "occasion")
    search_fields = ("name", "owner__username")


@admin.register(WornLog)
class WornLogAdmin(admin.ModelAdmin):
    list_display = ("owner", "worn_on", "occasion", "created_at")
    list_filter = ("occasion",)
