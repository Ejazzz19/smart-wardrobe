from rest_framework import serializers

from .models import ClothingItem, WornLog


class ClothingItemSerializer(serializers.ModelSerializer):
    # Accepts an uploaded file on write; image_url is populated server-side
    # after the upload to Cloudinary succeeds (see WardrobeItemViewSet).
    image = serializers.ImageField(write_only=True, required=False)
    times_worn = serializers.SerializerMethodField()
    cost_per_wear = serializers.SerializerMethodField()

    class Meta:
        model = ClothingItem
        fields = (
            "id",
            "name",
            "category",
            "color",
            "season",
            "occasion",
            "image",
            "image_url",
            "price",
            "created_at",
            "times_worn",
            "cost_per_wear",
        )
        read_only_fields = ("image_url", "created_at")

    def get_times_worn(self, obj):
        return obj.worn_logs.count()

    def get_cost_per_wear(self, obj):
        worn_count = obj.worn_logs.count()
        if obj.price is None or worn_count == 0:
            return None
        return round(float(obj.price) / worn_count, 2)


class WornLogSerializer(serializers.ModelSerializer):
    items = serializers.PrimaryKeyRelatedField(
        many=True, queryset=ClothingItem.objects.all(), write_only=True
    )
    items_detail = ClothingItemSerializer(source="items", many=True, read_only=True)

    class Meta:
        model = WornLog
        fields = ("id", "items", "items_detail", "worn_on", "occasion", "created_at")
        read_only_fields = ("created_at",)

    def validate_items(self, items):
        request = self.context["request"]
        for item in items:
            if item.owner_id != request.user.id:
                raise serializers.ValidationError(
                    "One or more items do not belong to the current user."
                )
        return items
