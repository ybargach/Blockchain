from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings

class GameResult(models.Model):
    GAME_TYPES = [
        ('ON', 'Online Match'),
    ]

    game_type = models.CharField(max_length=20, choices=GAME_TYPES)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='games_as_user', on_delete=models.CASCADE)
    opponent = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='games_as_opponent', on_delete=models.CASCADE)
    match_score = models.CharField(max_length=10)  # Format: "X-Y"
    user_status = models.CharField(max_length=10)  # Win/Lose
    timestamp = models.DateTimeField()
    
    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.username} vs {self.opponent.username} - {self.game_type}"