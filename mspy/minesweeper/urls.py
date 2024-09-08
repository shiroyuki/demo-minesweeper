from django.urls import path

from . import views

urlpatterns = [
    path("me", views.api_me),
    path("oauth/refresh", views.api_oauth_refresh_tokens),
    path("oauth/token", views.api_oauth_exchange_tokens),
    path("games/", views.game_session_root),
    path("games/<str:id>", views.game_session_individual),
    path("moves/", views.game_move_root),
    path("ping", views.api_ping),
]
