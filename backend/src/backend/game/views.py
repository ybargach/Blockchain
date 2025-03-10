from django.views import View
from django.conf import settings
import os
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from django.contrib.auth import get_user_model
from .models import GameResult
from rest_framework.permissions import IsAuthenticated
from .serializers import GameResultSerializer, UserSerializer
from django.http import FileResponse, JsonResponse, Http404
import logging

class GameResultAPIView(APIView):
    permission_classes = [IsAuthenticated]
    # get all game results for the current user
    def get(self, request):
        results = GameResult.objects.filter(user=request.user).select_related('user', 'opponent')
        serializer = GameResultSerializer(results, many=True)
        return Response(serializer.data)


    def post(self, request):
        User = get_user_model()
        try:
            data = request.data
            logging.debug(f"Received data: {data}")
            
            # Validate required fields
            required_fields = ['game_type', 'opponent', 'match_score', 'user_status', 'timestamp']
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                logging.error(f"Missing required fields: {missing_fields}")
                return Response(
                    {'status': 'error', 'message': f'Missing required fields: {missing_fields}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                # Get the opponent user
                opponent = User.objects.get(username=data['opponent'])
                
                # Get the current user from the request
                current_user = request.user

                # Create game result fields
                game_fields = {
                    'game_type': data['game_type'],
                    'opponent': opponent,
                    'user': current_user,
                    'match_score': data['match_score'],
                    'user_status': data['user_status'],
                    'timestamp': data['timestamp']
                }

                game_result = GameResult.objects.create(**game_fields)
                serializer = GameResultSerializer(game_result)
                
                return Response({
                    'status': 'success',
                    'data': serializer.data
                }, status=status.HTTP_201_CREATED)

            except User.DoesNotExist:
                return Response(
                    {'status': 'error', 'message': 'Opponent not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        except Exception as e:
            logging.error(f"Error saving game result: {str(e)}")
            return Response(
                {'status': 'error', 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class WinRate(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class=GameResultSerializer
    def get_queryset(self,request):
        print(request.user.id)
        return GameResult.objects.filter(
            user=request.user,
        )
    def get_queryset(self,request):
        print(request.user.id)
        return GameResult.objects.filter(
            user=request.user,
        )

    def get_querysetwin(self,request):
        print(request.user.id)
        return GameResult.objects.filter(
            user=request.user,
            user_status='Win'
        )
    def get_querysetlose(self,request):
        print(request.user.id)
        return GameResult.objects.filter(
            user=request.user,
            user_status='Lose'
        )

    def list(self, request, *args, **kwargs):
        #with transaction.atomic():

            queryset = self.get_queryset(request)
            querysetwin=self.get_querysetwin(request)
            querysetlose=self.get_querysetlose(request)
            # serializer = self.get_serializer(queryset, many=True)
            # print(serializer.data)
            count=queryset.count()
            countwin=querysetwin.count()
            countlose=querysetlose.count()

            return Response({
                'gameNumber': count,
                'Lose':countlose,
                'Win':countwin
            }, )