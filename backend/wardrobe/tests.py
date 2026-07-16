"""
Tests for the rule-based outfit suggestion engine (wardrobe/services.py).

Run with: python manage.py test wardrobe
"""
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase

from .models import ClothingItem, WornLog
from .services import suggest_outfit, temp_to_season


class TempToSeasonTests(TestCase):
    def test_hot_threshold(self):
        self.assertEqual(temp_to_season(30), "hot")
        self.assertEqual(temp_to_season(24), "hot")

    def test_mild_threshold(self):
        self.assertEqual(temp_to_season(23.9), "mild")
        self.assertEqual(temp_to_season(12), "mild")

    def test_cold_threshold(self):
        self.assertEqual(temp_to_season(11.9), "cold")
        self.assertEqual(temp_to_season(-5), "cold")


class SuggestOutfitTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tester", password="pass1234!")
        self.other_user = User.objects.create_user(username="other", password="pass1234!")

    def make_item(self, owner=None, **kwargs):
        defaults = {
            "name": "item",
            "category": "top",
            "season": "any",
            "occasion": "any",
        }
        defaults.update(kwargs)
        return ClothingItem.objects.create(owner=owner or self.user, **defaults)

    def test_any_occasion_matches_items_tagged_with_a_specific_occasion(self):
        # Regression test: requesting occasion="any" must match ALL items,
        # not just items literally tagged "any". This was a real bug found
        # during manual testing - a casual-tagged jacket was invisible to
        # an "any" occasion request before the fix.
        top = self.make_item(category="top", occasion="casual", season="mild")

        outfit = suggest_outfit(self.user, season="mild", occasion="any")

        self.assertEqual(outfit["top"], top)

    def test_any_season_matches_items_tagged_with_a_specific_season(self):
        top = self.make_item(category="top", season="cold", occasion="any")

        outfit = suggest_outfit(self.user, season="any", occasion="any")

        self.assertEqual(outfit["top"], top)

    def test_specific_occasion_excludes_non_matching_items(self):
        self.make_item(category="top", occasion="formal", season="mild")

        outfit = suggest_outfit(self.user, season="mild", occasion="casual")

        self.assertIsNone(outfit["top"])

    def test_item_tagged_any_matches_a_specific_requested_occasion(self):
        top = self.make_item(category="top", occasion="any", season="mild")

        outfit = suggest_outfit(self.user, season="mild", occasion="casual")

        self.assertEqual(outfit["top"], top)

    def test_outerwear_only_suggested_when_cold(self):
        self.make_item(category="outerwear", season="any", occasion="any")

        mild_outfit = suggest_outfit(self.user, season="mild", occasion="any")
        cold_outfit = suggest_outfit(self.user, season="cold", occasion="any")

        self.assertIsNone(mild_outfit["outerwear"])
        self.assertIsNotNone(cold_outfit["outerwear"])

    def test_dress_overrides_top_and_bottom(self):
        self.make_item(category="top", season="any", occasion="any")
        self.make_item(category="bottom", season="any", occasion="any")
        dress = self.make_item(category="dress", season="any", occasion="any")

        outfit = suggest_outfit(self.user, season="mild", occasion="any")

        self.assertEqual(outfit["dress"], dress)
        self.assertIsNone(outfit["top"])
        self.assertIsNone(outfit["bottom"])

    def test_least_worn_item_is_preferred(self):
        worn_top = self.make_item(category="top", name="worn a lot")
        fresh_top = self.make_item(category="top", name="never worn")

        WornLog.objects.create(owner=self.user, worn_on=date.today()).items.set([worn_top])

        outfit = suggest_outfit(self.user, season="mild", occasion="any")

        self.assertEqual(outfit["top"], fresh_top)

    def test_items_scoped_to_owner_only(self):
        self.make_item(owner=self.other_user, category="top", season="any", occasion="any")

        outfit = suggest_outfit(self.user, season="mild", occasion="any")

        self.assertIsNone(outfit["top"])

    def test_no_matching_items_returns_none_not_error(self):
        outfit = suggest_outfit(self.user, season="cold", occasion="formal")

        self.assertIsNone(outfit["top"])
        self.assertIsNone(outfit["bottom"])
        self.assertIsNone(outfit["shoes"])
