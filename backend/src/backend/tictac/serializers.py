from rest_framework import serializers
from .models import Game, GameStats
from django.contrib.auth import get_user_model

User  = get_user_model()

# Add UserSerializer
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']

class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = '__all__'

class GameStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameStats
        fields = ['wins', 'losses', 'ties', 'total_games']

# Add GameHistorySerializer
class GameHistorySerializer(serializers.ModelSerializer):
    player1 = UserSerializer(read_only = True)
    player2 = UserSerializer(read_only = True)
    
    class Meta:
        model = Game
        fields = ['id', 'player1', 'player2', 'winner', 'created_date']