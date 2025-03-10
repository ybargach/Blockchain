# from channels.generic.websocket import AsyncWebsocketConsumer
# from channels.db import database_sync_to_async
# from django.contrib.auth import get_user_model

# class UserStatusConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         user = self.scope["user"]
#         if user.is_authenticated:
#             # Set user as online when they connect
#             await self.set_user_status(True)
#             # Add them to a group to receive updates
#             await self.channel_layer.group_add(
#                 "user_status",
#                 self.channel_name
#             )
#             await self.accept()
#         else:
#             await self.close()

#     async def disconnect(self, close_code):
#         user = self.scope["user"]
#         if user.is_authenticated:
#             await self.set_user_status(False)
#             await self.channel_layer.group_discard(
#                 "user_status",
#                 self.channel_name
#             )
#             self.channel_layer.group_send(
#                 f"user_{self.user.id}",
#                 {
#                     "type": "status_update",
#                     "user_id": self.user.id,
#                     "is_online": False
#                 }
#             )
#             await self.close()


#     @database_sync_to_async
#     def set_user_status(self, status):
#         User = get_user_model()
#         User.objects.filter(id=self.scope["user"].id).update(is_online=status)


from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
import json
from .models import Friendship ,Notification

User = get_user_model()

# class UserStatusConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         self.user = self.scope["user"]
        
#         if not self.user.is_authenticated:
#             await self.close()
#             return

#         # Join user's personal group
#         self.group_name = f"user_{self.user.id}"
#         await self.channel_layer.group_add(
#             self.group_name,
#             self.channel_name
#         )

#         # Join all friends' groups
#         friend_groups = await self.get_friend_groups()
#         for group in friend_groups:
#             await self.channel_layer.group_add(
#                 group,
#                 self.channel_name
#             )

#         # Mark user as online
#         await self.set_online_status(True)
        
#         # Notify friends that user is online
#         await self.notify_friends_status(True)
        
#         await self.accept()

#     async def disconnect(self, close_code):
#         if hasattr(self, 'user') and self.user.is_authenticated:
#             # Mark user as offline
#             await self.set_online_status(False)
            
#             # Notify friends that user is offline
#             await self.notify_friends_status(False)
            
#             # Leave all groups
#             await self.channel_layer.group_discard(
#                 self.group_name,
#                 self.channel_name
#             )
            
#             friend_groups = await self.get_friend_groups()
#             for group in friend_groups:
#                 await self.channel_layer.group_discard(
#                     group,
#                     self.channel_name
#                 )

#     @database_sync_to_async
#     def get_friend_groups(self):
#         friendships = Friendship.objects.filter(user=self.user)
#         return [f"user_{friendship.friend.id}" for friendship in friendships]

#     @database_sync_to_async
#     def set_online_status(self, status):
#         self.user.is_online = status
#         self.user.save()

#     async def notify_friends_status(self, is_online):
#         friend_groups = await self.get_friend_groups()
        
#         for group in friend_groups:
#             await self.channel_layer.group_send(
#                 group,
#                 {
#                     "type": "user_status",
#                     "user_id": self.user.id,
#                     "is_online": is_online
#                 }
#             )
    

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
import json
from .models import Friendship, Notification
from asgiref.sync import async_to_sync
import time

User = get_user_model()


user_connections = {}

class UserStatusConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        
        if not self.user.is_authenticated:
            await self.close()
            return

        
        self.connection_id = f"{self.channel_name}_{time.time()}"
        
        await self.add_connection()
        
        self.group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        friend_groups = await self.get_friend_groups()
        for group in friend_groups:
            await self.channel_layer.group_add(
                group,
                self.channel_name
            )

        if await self.is_first_connection():
            await self.set_online_status(True)
            
            await self.notify_friends_status(True)
        
        await self.accept()

    async def disconnect(self, close_code):
        if not hasattr(self, 'user') or not self.user.is_authenticated:
            return
            
        await self.remove_connection()
        
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        
        friend_groups = await self.get_friend_groups()
        for group in friend_groups:
            await self.channel_layer.group_discard(
                group,
                self.channel_name
            )
        
        if not await self.has_active_connections():
            await self.set_online_status(False)
            
            await self.notify_friends_status(False)

    @database_sync_to_async
    def add_connection(self):
        user_id = str(self.user.id)
        if user_id not in user_connections:
            user_connections[user_id] = {}
        user_connections[user_id][self.connection_id] = time.time()
        return len(user_connections[user_id])
    
    @database_sync_to_async
    def remove_connection(self):
        user_id = str(self.user.id)
        if user_id in user_connections and self.connection_id in user_connections[user_id]:
            del user_connections[user_id][self.connection_id]
            if not user_connections[user_id]:  # If no connections left
                del user_connections[user_id]
            return False if user_id not in user_connections else len(user_connections[user_id])
        return 0
    
    @database_sync_to_async
    def is_first_connection(self):
        user_id = str(self.user.id)
        return user_id in user_connections and len(user_connections[user_id]) == 1
    
    @database_sync_to_async
    def has_active_connections(self):
        user_id = str(self.user.id)
        return user_id in user_connections and len(user_connections[user_id]) > 0

    @database_sync_to_async
    def get_friend_groups(self):
        friendships = Friendship.objects.filter(user=self.user)
        return [f"user_{friendship.friend.id}" for friendship in friendships]

    @database_sync_to_async
    def set_online_status(self, status):
        self.user.is_online = status
        self.user.save()

    async def notify_friends_status(self, is_online):
        friend_groups = await self.get_friend_groups()
        
        for group in friend_groups:
            await self.channel_layer.group_send(
                group,
                {
                    "type": "user_status",
                    "user_id": self.user.id,
                    "is_online": is_online
                }
            )
    
    async def user_status(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'user_id': event['user_id'],
            'is_online': event['is_online']
        }))
# class UserNotificationCunsomer(AsyncWebsocketConsumer):
#     async def connect(self):
#         # When a user connects to the WebSocket
#         self.user = self.scope["user"]
#         if not self.user.is_authenticated:
#             await self.close()
#             return

#         # Create a personal notification channel for this user
#         self.notification_group_name = f'user_{self.user.id}_notifications'
        
#         await self.channel_layer.group_add(
#             self.notification_group_name,
#             self.channel_name
#         )
#         await self.accept()

#     async def notification_message(self, event):
#         # When we receive a notification to send
#         await self.send(text_data=json.dumps(event['message']))


class UserNotificationCunsomer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return

        # Create a personal notification channel for this user
        self.notification_group_name = f'user_{self.user.id}_notifications'
        
        await self.channel_layer.group_add(
            self.notification_group_name,
            self.channel_name
        )
        await self.accept()

        # Check for unread notifications
        has_notifications = await self.check_unread_notifications()
        if has_notifications:
            await self.send(text_data=json.dumps({
                'message': 'You have new notifications'
            }))

    async def disconnect(self, close_code):
        if hasattr(self, 'notification_group_name'):
            await self.channel_layer.group_discard(
                self.notification_group_name,
                self.channel_name
            )

    async def notification_message(self, event):
        await self.send(text_data=json.dumps(event['message']))

    @database_sync_to_async
    def check_unread_notifications(self):
        return Notification.objects.filter(
            user=self.user,
            read=False
        ).exists()