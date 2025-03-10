from django.contrib import admin
from .models import GameResult

@admin.register(GameResult)
class GameResultAdmin(admin.ModelAdmin):
    list_display = ('game_type', 'user', 'opponent', 'match_score', 'user_status', 'timestamp')
    list_filter = ('game_type', 'user_status', 'timestamp')
    search_fields = ('user__username', 'opponent__username')
    ordering = ('-timestamp',)
