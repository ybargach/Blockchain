from django.urls import path
from .views import CreateGame, MakeMove, MatchCanceled, Exit_game, PlayerStats, GameHistory

urlpatterns = [
    path('api/create_game/', CreateGame.as_view(), name='create_game'),
    path('api/make_move/', MakeMove.as_view(), name='make_move'),
    path('api/match_canceled/', MatchCanceled.as_view(), name='match_canceled'),
    path('api/exit_game/', Exit_game.as_view(), name='exit_game'),
    path('api/stats/', PlayerStats.as_view(), name='player_stats'),
    path('api/games/history/', GameHistory.as_view(), name='game_history'),
]