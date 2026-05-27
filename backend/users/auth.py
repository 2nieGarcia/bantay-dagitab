"""Email-or-username authentication backend.

Django's default ModelBackend only looks up `User.username`. Households
register through /register with `username = email`, but other accounts
(superusers, seed data, migrated users) may have a non-email username.
This backend resolves the supplied identifier against either column,
case-insensitively, so the JWT login form works in both cases.

Wired into AUTHENTICATION_BACKENDS in core/settings.py.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class EmailOrUsernameBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or not password:
            return None

        UserModel = get_user_model()
        try:
            user = UserModel.objects.get(
                Q(username__iexact=username) | Q(email__iexact=username)
            )
        except UserModel.DoesNotExist:
            # Run the default password hasher anyway to keep timing uniform
            # and avoid leaking which identifiers exist via response time.
            UserModel().set_password(password)
            return None
        except UserModel.MultipleObjectsReturned:
            # Two users share this identifier across the username/email
            # columns. Prefer the one whose username matched exactly.
            user = UserModel.objects.filter(username__iexact=username).first()
            if user is None:
                return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
