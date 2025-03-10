from django import forms
from .models import GameResult

class GameResultForm(forms.ModelForm):
    class Meta:
        model = GameResult
        fields = ['game_type','player1', 'player2', 'player1_score', 'player2_score', 'winner', 'timestamp', 'is_tournament_match', 'tournament_stage']
