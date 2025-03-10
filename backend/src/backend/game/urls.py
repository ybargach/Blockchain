from django.urls import path
from .views import GameResultAPIView, WinRate

urlpatterns = [
    path('api/game-results/', GameResultAPIView.as_view(), name='game_results'),
    path('winrate/', WinRate.as_view(), name='winrate'),
    # path('api/tournament/request/', request_tournament, name='request_tournament'),
]