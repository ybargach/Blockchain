
from django.db import models
from django.conf import settings
from django.utils import timezone


class FriendRequest(models.Model):
    PENDING = 'pending'
    ACCEPTED = 'accepted'
    REJECTED = 'rejected'
    
    STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (ACCEPTED, 'Accepted'),
        (REJECTED, 'Rejected'),
    ]

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='user', on_delete=models.CASCADE)
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='friend', on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        #unique_together = ('sender', 'receiver')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sender.username} -> {self.receiver.username} ({self.status})"
    


class Friendship(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='friendships', on_delete=models.CASCADE)
    friend = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='friends', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'friend')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} is friends with {self.friend.username}"
    
    @classmethod
    def are_friends(cls, user1, user2):
        return cls.objects.filter(user=user1, friend=user2).exists()
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['friend']['is_online'] = instance.friend.is_online
        return data
    


class Notification(models.Model):
    TYPES = (
        ('SENT', 'Friend Request Sent'),
        ('ACCEPTED', 'Friend Request Accepted')
    )
    friend_request = models.ForeignKey(FriendRequest, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE)
    notification_type = models.CharField(max_length=255, choices=TYPES)

    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.friend_request.sender.username}"
    
    def create(self):
        # This method creates a new notification
        self.save()
        return self

    def generate_notification_payload(self):
        # This method creates a consistent format for our WebSocket messages
        return {
            'id': self.id,
            'type': self.notification_type,
            'sender': self.friend_request.sender.username,
            'message': self.get_notification_message(),
            'created_at': self.created_at.isoformat(),
            'read': self.read
        }

    def get_notification_message(self):
        # This creates human-readable messages for each notification type
        if self.notification_type == 'SENT':
            return f"{self.friend_request.sender.username} sent you a friend request"
        elif self.notification_type == 'ACCEPTED':
            return f"{self.friend_request.receiver.username} accepted your friend request"