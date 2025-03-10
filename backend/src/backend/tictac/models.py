from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
from django.utils.timezone import now 
class Game(models.Model):
    id = models.AutoField(primary_key=True, default=None)
    player1 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='games_as_player1', db_column='player1')
    player2 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='games_as_player2', db_column='player2', null=True, blank=True)
    board = models.CharField(max_length=9, default=" " * 9)
    current_player = models.CharField(max_length=1, default="X")
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='games_won'
    )
    game_over = models.BooleanField(default=False)
    game_mode = models.CharField(max_length=50, default="online")
    created_date = models.DateTimeField(auto_now_add=now)
    status = models.CharField(max_length=20, default='waiting')
    

    def __str__(self):
        return f"Game {self.id}: {self.player1} vs {self.player2 or 'Waiting...'}"


class GameStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    ties = models.IntegerField(default=0)
    total_games = models.IntegerField(default=0)

    def __str__(self):
        return f"Stats for {self.user.username}"

    @property
    def win_rate(self):
        if self.total_games > 0:
            return round((self.wins / self.total_games) * 100)
        return 0