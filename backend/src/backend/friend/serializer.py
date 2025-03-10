from rest_framework import serializers
from .models import FriendRequest, Friendship, Notification
from django.contrib.auth import get_user_model


User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name','avatar']

class FriendRequestSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    receiver_id = serializers.IntegerField(write_only=True)
    
        
    class Meta:
        model = FriendRequest
        fields = ['id', 'sender', 'receiver', 'receiver_id', 'status', 'created_at', 'updated_at']
        read_only_fields = ['status']

    def validate_receiver_id(self, value):
        request = self.context.get('request')
        if request:
            # Check if receiver exists
            try:
                receiver = User.objects.get(id=value)
            except User.DoesNotExist:
                raise serializers.ValidationError("Receiver does not exist")
            
            # Can't send request to yourself
            if receiver == request.user:
                raise serializers.ValidationError("You cannot send friend request to yourself")
            
            # Check if friend request already exists
            if FriendRequest.objects.filter(
                sender=request.user,
                receiver=receiver,
                status=FriendRequest.PENDING
            ).exists():
                raise serializers.ValidationError("Friend request already sent")
            
            if FriendRequest.objects.filter(
                sender= receiver,
                receiver=request.user,
                status=FriendRequest.PENDING
            ).exists():
                raise serializers.ValidationError("this user has already sent you a friend request")
            
            # Check if they are already friends
            if Friendship.are_friends(request.user, receiver):
                raise serializers.ValidationError("You are already friends")
                
            return value
        raise serializers.ValidationError("No request object found")

class FriendshipSerializer(serializers.ModelSerializer):
    friend = UserSerializer()
    
    class Meta:
        model = Friendship
        fields = ['id', 'friend', 'created_at']
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['friend']['is_online'] = instance.friend.is_online
        return data
    
class NotificationSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    friend_request = FriendRequestSerializer()
    
    class Meta:
        model = Notification
        fields = ['id', 'friend_request', 'user', 'read', 'created_at', 'notification_type']