import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from channels.auth import AuthMiddlewareStack

from .models import Game

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.group_name = f'game_{self.game_id}'
        
        print(f"🎮 WebSocket connecting...5")
        print(f"🎮 User: {self.user}")
        print(f"🎮 Game ID: {self.game_id}")
        print(f"🎮 Group name: {self.group_name}")

        if not self.user.is_authenticated:
            print("🎮 User not authenticated")
            await self.close()
            return
        
        try:
            # Check if user is already in the game
            game = await database_sync_to_async(Game.objects.get)(id=self.game_id)
            
            # Create a unique user-specific channel name to track this user's connection
            self.unique_channel_name = f"user_{self.user.id}_game_{self.game_id}"
            
            # Check if this user already has an active connection
            group_channels = getattr(self.channel_layer, 'groups', {}).get(self.group_name, set())
            
            for channel in group_channels:
                if channel.startswith(self.unique_channel_name):
                    print(f"🎮 User {self.user.username} already has an active connection to game {self.game_id}")
                    await self.close()
                    return
            
            # Make channel name unique to this user and game
            self.channel_name = f"{self.unique_channel_name}_{self.channel_name}" 
            
            # Add to group with the unique channel name
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
            print(f"🎮 Successfully joined group {self.group_name}")
            
        except Exception as e:
            print(f"🎮 Error in connect: {str(e)}")
            await self.close()

    async def receive(self, text_data):
        """Handle messages received from WebSocket clients"""
        print(f"🎮 Received WebSocket message: {text_data}")
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            # Log the message type for debugging
            print(f"🎮 Message type: {message_type}")
            
            if message_type == "game.start":
                await self.game_start(data)
            elif message_type == "exit_game":
                await self.exit_game(data)
            elif message_type == "game_move":
                await self.game_move(data)
            elif message_type == "game_tie":
                await self.game_tie(data)
            elif message_type == "game_winner":
                await self.game_winner(data)
            
        except json.JSONDecodeError as e:
            print(f"🎮 Error decoding JSON: {e}")
        except Exception as e:
            print(f"🎮 Error handling message: {e}")

    async def game_start(self, event):
        """Handle game_start messages from channel layer"""
        print("🎮 Handling game.start event:", event)
        await self.send(text_data=json.dumps({
            "type": "game_start",
            'game_id': event.get('game_id'),
            'player1': event.get('player1'),
            'player2': event.get('player2'),
            'message': event.get('message')
        }))

    async def exit_game(self, event):
        await self.send(text_data=json.dumps({
            'type': 'exit_game',
            'player_exited': event['player_exited'],
            'player_role': event.get('player_role'),  # player_role for the player who exited
            'winner': event.get('winner'),            # Winner name
            'winner_id': event.get('winner_id')       # Winner ID
        }))

    async def game_move(self, event):
        """Handle game_move messages from channel layer"""
        await self.send(text_data=json.dumps({
            "type": "game_move",
            "index": event["index"],
            "player": event["player"]
        }))
    
    async def game_tie(self, event):
        """Handle game_tie messages from channel layer"""
        await self.send(text_data=json.dumps({
            "type": "game_tie",
            "last_move": event["last_move"],
            "board": event["board"]
        }))
    
    async def game_winner(self, event):
        """Handle game_winner messages from channel layer"""
        await self.send(text_data=json.dumps({
            "type": "game_winner",
            "winner": event["winner"],
            "winnerName": event["winnerName"],
            "board": event["board"]
        }))

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        try:
            self.user = self.scope["user"]
            print(f"🎮 User {self.user} disconnected")
            # Get game info before disconnecting
            game = await database_sync_to_async(Game.objects.get)(id=self.game_id)
            
            # Only handle disconnection if game is still active
            if not game.game_over:
                # Determine the disconnecting player's role
                player_role = 'X' if game.player1 == self.user else 'O'
                player_name = self.user.username
                
                # Set winner based on who disconnected
                if player_role == 'O':
                    winner = game.player1  # X wins when O disconnects
                else:
                    winner = game.player2  # O wins when X disconnects
                
                # Update game state
                await database_sync_to_async(self.update_game_on_disconnect)(game, winner)
                
                # Notify other players
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'exit_game',
                        'player_exited': player_name,
                        'player_role': player_role,
                        'winner': winner.username,
                        'winner_id': winner.id
                    }
                )
        except Exception as e:
            print(f"Error in disconnect handler: {str(e)}")
        finally:
            # Always remove from the group
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
    
    @database_sync_to_async
    def update_game_on_disconnect(self, game, winner):
        """Update game state when a player disconnects"""
        if not game.game_over:
            game.game_over = True
            game.winner = winner
            game.status = "finished"
            game.save()