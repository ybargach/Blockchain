from channels.generic.websocket import AsyncWebsocketConsumer
import json
import re
from django.contrib.auth import get_user_model

# Change the players structure to store both channel_name and username
players = []  # Will store tuples of (channel_name, username)
players_in_game = []  # Will store tuples of (channel_name, username)

class MatchmakingConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        if self.scope["user"].is_authenticated:
            self.user = self.scope["user"]
            # Store both channel name and username
            player_info = (self.channel_name, self.user.username)
            
            # Check if the user is already in a game
            if any(p[1] == self.user.username for p in players_in_game):
                print(f"User {self.user.username} is already in a game")
                await self.close()
                return
            
            # Check if the user is already in the queue
            if any(p[1] == self.user.username for p in players):
                print(f"User {self.user.username} is already in the queue")
                await self.close()
                return
            
            # Add the user to the queue
            players.append(player_info)
            print(f"User {self.user.username} connected and added to queue")
            
            await self.accept()
        else:
            print("Unauthorized connection attempt rejected")
            await self.close()

    async def disconnect(self, close_code):
        # Remove player using channel_name
        for player in players[:]:
            if player[0] == self.channel_name:
                players.remove(player)
                print(f"User {player[1]} disconnected")
                break

        # Remove player from players_in_game if they were in a game
        for player in players_in_game[:]:
            if player[0] == self.channel_name:
                players_in_game.remove(player)
                print(f"User {player[1]} removed from active game")
                break

    async def receive(self, text_data):
        try:
            if not self.scope["user"].is_authenticated:
                print("Unauthenticated user tried to join queue")
                return

            data = json.loads(text_data)
            if data.get("action") == "join_queue":
                username = self.scope["user"].username
                print(f"User {username} joining queue")
                
                # Remove any existing entries for this user
                for player in players[:]:
                    if player[1] == username:
                        players.remove(player)
                
                # Add the player to queue
                players.append((self.channel_name, username))
                print(f"Current players in queue: {[p[1] for p in players]}")  # Print usernames only
                
                # Match players if there are at least 2 different users
                if len(players) >= 2:
                    await self.try_match_players()
        except Exception as e:
            print(f"Error in receive: {str(e)}")

    async def try_match_players(self):
        # Find two different users
        for i, player1 in enumerate(players):
            for j, player2 in enumerate(players):
                if i != j and player1[1] != player2[1]:  # Different indices and usernames
                    # Create room name
                    room_name = f"{min(player1[1], player2[1])}_{max(player1[1], player2[1])}"
                    room_name = re.sub(r'[^a-zA-Z0-9_]', '_', room_name)
                    
                    print(f"Match found: {player1[1]} vs {player2[1]} in room {room_name}")
                    
                    # Store player info before removing from queue
                    player1_info = player1
                    player2_info = player2
                    
                    # Remove players from queue
                    players.remove(player2)  # Remove second player first
                    players.remove(player1)
                    
                    # Add players to players_in_game
                    players_in_game.append(player1_info)
                    players_in_game.append(player2_info)
                    
                    # Send match found to both players with correct usernames
                    await self.send_match_found(
                        player1_info[0],  # channel name
                        room_name,
                        "player1",
                        player1_info[1],  # username
                        player2_info[1]   # opponent username
                    )
                    await self.send_match_found(
                        player2_info[0],  # channel name
                        room_name,
                        "player2",
                        player1_info[1],  # username
                        player2_info[1]   # opponent username
                    )
                    return True
        return False

    async def send_match_found(self, player_channel, room_name, role, player1_username, player2_username):
        await self.channel_layer.send(
            player_channel,
            {
                "type": "match.found",
                "room_name": room_name,
                "role": role,
                "player1_username": player1_username,
                "player2_username": player2_username
            }
        )

    async def match_found(self, event):
        await self.send(text_data=json.dumps({
            "type": "match_found",
            "room_name": event["room_name"],
            "role": event["role"],
            "players": {
                "player1": event["player1_username"],
                "player2": event["player2_username"]
            }
        }))

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'game_{self.room_name}'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "game_state", "data": data, "sender_channel": self.channel_name}
        )

    async def game_state(self, event):
        if event["sender_channel"] != self.channel_name:
            await self.send(text_data=json.dumps(event["data"]))