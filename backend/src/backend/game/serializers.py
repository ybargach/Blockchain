from rest_framework import serializers
from .models import GameResult
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'avatar']

class GameResultSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    opponent = UserSerializer(read_only=True)

    class Meta:
        model = GameResult
        fields = [
            'id',
            'game_type',
            'user',
            'opponent',
            'match_score',
            'user_status',
            'timestamp'
        ]