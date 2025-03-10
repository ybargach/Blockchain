from django.shortcuts import render
from django.views.generic import TemplateView
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from .models import Game
from .serializers import GameSerializer
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from .models import GameStats
from .serializers import GameStatsSerializer
from django.utils.decorators import method_decorator
from django.db.models import Q
from .serializers import GameHistorySerializer, GameSerializer, GameStatsSerializer

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from rest_framework.permissions import IsAuthenticated

class CreateGame(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            player = request.user
            print(f"Received request for player: {player.username}")
            print(f"Request data: {request.data}")

            # Check for existing waiting game with proper type handling
            waiting_game = Game.objects.filter(
                player2__isnull = True,
                player1__isnull = False,
                status = 'waiting'  # Added status check
            ).exclude(
                player1 = player.id
            ).first()
            
            if waiting_game:
                try:
                    waiting_game.player2 = player
                    waiting_game.status = 'started'
                    waiting_game.save()
                                
                    return Response({
                        **GameSerializer(waiting_game).data,
                        'status': 'started'
                    }, status=status.HTTP_200_OK)
                except Exception as e:
                    print(f"Error joining existing game: {str(e)}")
                    return Response({
                        'status': 'error',
                        'message': f'Error joining game: {str(e)}'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            try:
                new_game = Game.objects.create(
                    player1=player,
                    status='waiting'
                )
                return Response({
                    **GameSerializer(new_game).data,
                    'status': 'waiting'
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                print(f"Error creating new game: {str(e)}")
                return Response({
                    'status': 'error',
                    'message': f'Error creating new game: {str(e)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            print(f"Unexpected error in CreateGame: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'Unexpected error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MakeMove(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            game_id = request.data.get('game_id')
            index = request.data.get('index')
            player = request.data.get('player')  # 'X' or 'O'
            current_user = request.user

            if not isinstance(index, int) or not (0 <= index < 9):
                return Response({'status': 'error', 'message': 'Invalid index'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                game = Game.objects.get(id=game_id)
            except Game.DoesNotExist:
                return Response({'status': 'error', 'message': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

            # Verify that the user is a player in this game
            if current_user != game.player1 and current_user != game.player2:
                return Response({'status': 'error', 'message': 'You are not a player in this game'}, 
                              status=status.HTTP_403_FORBIDDEN)

            # Verify it's the correct player's turn
            current_player_user = game.player1 if player == 'X' else game.player2
            if current_user != current_player_user:
                return Response({'status': 'error', 'message': 'Not your turn'}, 
                              status=status.HTTP_400_BAD_REQUEST)

            if game.game_over:
                print(f"Game {game_id} is already over")
                return Response({'status': 'error', 'message': 'Game is already over'}, 
                              status=status.HTTP_400_BAD_REQUEST)

            board = list(game.board)

            if board[index] != ' ':
                print(f"Player {current_user.username} tried to move to an occupied space")
                return Response({'status': 'error', 'message': 'Invalid move'}, 
                              status=status.HTTP_400_BAD_REQUEST)

            # Make move
            board[index] = player
            game.board = "".join(board)
            game.current_player = 'O' if player == 'X' else 'X'
            game.save()

            # Check for winner
            if self.check_winner(board, player):
                print(f"Player {current_user.username} wins!")
                game.winner = current_user  # Store the actual user object
                game.game_over = True
                game.status = 'finished'
                game.save()

                # Update stats for both players
                winner = current_user
                loser = game.player2 if winner == game.player1 else game.player1
                
                # Update stats
                winner_stats, _ = GameStats.objects.get_or_create(user=winner)
                loser_stats, _ = GameStats.objects.get_or_create(user=loser)
                
                winner_stats.wins += 1
                winner_stats.total_games += 1
                winner_stats.save()
                
                loser_stats.losses += 1
                loser_stats.total_games += 1
                loser_stats.save()

                return Response({
                    'status': 'winner',
                    'message': f'Player {current_user.username} wins!',
                    'last_move': index,
                    'current_player': game.current_player,
                    'winner_id': current_user.id,
                    'winnerName': current_user.username,
                    'board': game.board
                }, status=status.HTTP_200_OK)

            if self.check_tie(board):
                print("The game is a tie!")
                game.game_over = True
                game.status = 'finished'
                game.save()

                # Update stats for both players
                PlayerStats().update_stats(game.player1, False, True)
                PlayerStats().update_stats(game.player2, False, True)

                return Response({
                    'status': 'tie',
                    'message': 'The game is a tie!',
                    'board': game.board,
                    'last_move': index,
                    'current_player': game.current_player,
                    'player': current_user.username
                }, status=status.HTTP_200_OK)

            return Response({
                'status': 'success',
                'message': 'Move accepted',
                'board': game.board,
                'current_player': game.current_player
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(e)
            return Response({'status': 'error', 'message': str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)

    def check_winner(self, board, player):
        winning_combinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ]
        return any(board[a] == board[b] == board[c] == player for a, b, c in winning_combinations)

    def check_tie(self, board):
        return ' ' not in board


class MatchCanceled(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request):
        try:
            game_id = request.data.get('game_id')
            current_user = request.user

            try:
                game = Game.objects.get(id=game_id)
            except Game.DoesNotExist:
                return Response({'status': 'error', 'message': 'Game not found'}, 
                              status=status.HTTP_404_NOT_FOUND)

            # Verify the user is the creator of the game
            if game.player1 != current_user:
                return Response({'status': 'error', 'message': 'Not authorized to cancel this game'}, 
                              status=status.HTTP_403_FORBIDDEN)

            if game.status == 'waiting':
                print(f"Game {game_id} canceled by {current_user.username}")
                game.delete()
                return Response({'status': 'success', 'message': 'Game canceled'}, 
                              status=status.HTTP_200_OK)
            elif game.status == 'started':
                print(f"Game {game_id} canceled by {current_user.username}")
                game.delete()
                return Response({'status': 'success', 'message': 'Game canceled'},
                                status=status.HTTP_200_OK)


            return Response({'status': 'error', 'message': 'Game is already started'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print("BACKEND ELBOUKH:_>", e)
            return Response({'status': 'error', 'message': str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)

class Exit_game(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            game_id = request.data.get('game_id')
            player_role = request.data.get('player_role')
            current_user = request.user

            try:
                game = Game.objects.get(id=game_id)
            except Game.DoesNotExist:
                return Response({'status': 'error', 'message': 'Game not found'})

            # Determine winner and loser based on player_role
            if player_role == 'O':
                winner = game.player1  # Player X wins when O disconnects
                loser = game.player2
            else:  # player_role == 'X'
                winner = game.player2  # Player O wins when X disconnects
                loser = game.player1

            # Update the game record
            game.winner = winner
            game.status = "finished"
            game.game_over = True
            game.save()

            # Update stats for both players
            PlayerStats().update_stats(winner, True)  # Winner gets a win
            PlayerStats().update_stats(loser, False)  # Loser gets a loss

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'game_{game_id}',
                {
                    'type': 'exit_game',
                    'player_exited': request.data.get('player_exited'),
                    'player_role': player_role,
                    'winner': winner.username,
                    'winner_id': winner.id
                }
            )
            return Response({
                'status': 'success', 
                'message': 'Game ended',
                'winner': winner.username,
                'winner_id': winner.id
            })
        except Exception as e:
            return Response({
                'status': 'error', 
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class PlayerStats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get player statistics"""
        stats, created = GameStats.objects.get_or_create(user=request.user)
        serializer = GameStatsSerializer(stats)
        return Response(serializer.data)

    def post(self, request):
        """Update player statistics"""
        try:
            is_win = request.data.get('is_win', False)
            is_tie = request.data.get('is_tie', False)
            
            stats, created = GameStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            
            if is_tie:
                stats.ties += 1
            elif is_win:
                stats.wins += 1
            else:
                stats.losses += 1
            
            stats.save()
            
            return Response({
                'status': 'success',
                'message': 'Stats updated successfully'
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    def update_stats(self, user, is_winner, is_tie=False):
        """Update player statistics"""
        stats, created = GameStats.objects.get_or_create(user=user)
        stats.total_games += 1
        
        if is_tie:
            stats.ties += 1
        elif is_winner:
            stats.wins += 1
        else:
            stats.losses += 1
        
        stats.save()
        return stats

class GameHistory(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get user's game history"""
        games = Game.objects.filter(
            Q(player1=request.user) | Q(player2=request.user),
            status='finished'
        ).order_by('-created_date')[:20] 
        
        serializer = GameHistorySerializer(games, many=True)
        return Response(serializer.data)