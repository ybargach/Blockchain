
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework import  status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import FriendRequest, Friendship ,Notification
from .serializer import FriendRequestSerializer, FriendshipSerializer, NotificationSerializer
from django.db import transaction
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db.transaction import atomic




class SendFriendRequestView(GenericAPIView):
    serializer_class = FriendRequestSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            friend_request = FriendRequest.objects.create(
                sender=request.user,
                receiver_id=serializer.validated_data['receiver_id'],
                sender_id=request.user.id,
                status=FriendRequest.PENDING
            )
            notification = Notification.objects.create(
                    user=friend_request.receiver,
                    notification_type='SENT',
                    friend_request=friend_request
                )
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                    f'user_{friend_request.receiver.id}_notifications',
                    {
                        'type': 'notification_message',
                        'message': notification.generate_notification_payload()
                    }
                )
            return Response(
                self.get_serializer(friend_request).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class AcceptFriendRequestView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer

    def post(self, request):
        request_id = request.data.get('request_id')
        if not request_id:
            return Response(
                {'error': 'request_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        friend_request = get_object_or_404(
            FriendRequest,
            id=request_id,
            receiver=request.user,
            status=FriendRequest.PENDING
        )

        friend_request.status = FriendRequest.ACCEPTED
        friend_request.save()
        Friendship.objects.create(user=friend_request.sender, friend=friend_request.receiver)
        Friendship.objects.create(user=friend_request.receiver, friend=friend_request.sender)
        
        Notification.objects.filter(
               friend_request=friend_request,
               user=friend_request.receiver  
           ).delete()
        
        notification = Notification.objects.create(
            user=friend_request.sender,
            notification_type='ACCEPTED',
            friend_request=friend_request
        )

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
                    f'user_{friend_request.sender.id}_notifications',
                    {
                        'type': 'notification_message',
                        'message': notification.generate_notification_payload()
                    }
                )
        

        return Response({
            'message': 'Friend request accepted',
            'friend_request': self.get_serializer(friend_request).data
        })
    def get(self,request):
        return Response({
            'message':'Hello'
        })
    
class RejectFriendRequestView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer

    def post(self, request):
        request_id = request.data.get('request_id')
        friend_request = get_object_or_404(
            FriendRequest,
            id=request_id,
            receiver=request.user,
            status=FriendRequest.PENDING
        )

        friend_request.status = FriendRequest.REJECTED
        friend_request.save()
        
        return Response({
            'message': 'Friend request rejected',
            'friend_request': self.get_serializer(friend_request).data
        })
    
class CancelFriendRequestView(GenericAPIView):

    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer

    def post(self, request):
        request_id = request.data.get('request_id')
        friend_request = get_object_or_404(
            FriendRequest,
            id=request_id,
            sender=request.user,
            status=FriendRequest.PENDING
        )
        
        friend_request.delete()
        return Response({
            'message': 'Friend request cancelled'
        }, status=status.HTTP_200_OK)

class ListFriendsView(ListAPIView):
    serializer_class = FriendshipSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return Friendship.objects.filter(user=self.request.user)
    

class ListReceivedFriendRequestsView(ListAPIView):
    serializer_class = FriendRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FriendRequest.objects.filter(receiver=self.request.user)
    
class ListSentFriendRequestsView(ListAPIView):
    serializer_class = FriendRequestSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return FriendRequest.objects.filter(sender=self.request.user)

class UnfriendView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendshipSerializer

    def post(self, request):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        friendship1 = Friendship.objects.filter(user=request.user, friend_id=user_id).exists()
        friendship2 = Friendship.objects.filter(user_id=user_id, friend=request.user).exists()

        if not friendship1 and not friendship2:
            return Response(
                {'error': 'Friendship not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Delete both friendship entries
        Friendship.objects.filter(user=request.user, friend_id=user_id).delete()
        Friendship.objects.filter(user_id=user_id, friend=request.user).delete()

        return Response({
            'message': 'Successfully unfriended user'
        }, status=status.HTTP_200_OK)
    

class ListNotificationsView(ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

# class ListNotificationsView(ListAPIView):
#     serializer_class = NotificationSerializer
#     permission_classes = [IsAuthenticated]
#     def get_queryset(self):
#         notification=Notification.objects.filter(user=self.request.user)
#         for notif in notification:
#             notif.read=True
#             notif.save()
#             friendRequest=FriendRequest.objects.filter(id=notif.friend_request.id).all()
#         return notification
    

class GetUnreadCount(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    def get(self,request):
        unread_count = Notification.objects.filter(user=request.user, read=False).count()
        return Response({
            'unread_count': unread_count,
        },status=status.HTTP_200_OK)


class UnreadNotificationsView(ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self,request):
        print(request.user.id)
        return Notification.objects.filter(
            user=request.user,
            read=False
        ).order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        #with transaction.atomic():
            # Get unread notifications
            queryset = self.get_queryset(request)
            
            serializer = self.get_serializer(queryset, many=True)
            print(serializer.data)
            # Mark all as read
            count=queryset.count()
            queryset.update(read=True)
            
            return Response({
                'count': count,
                'notifications': serializer.data
            }, )
        

class TypeOffriendship(GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self,request):
        user_id = request.data['user_id']
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        friendship1 = Friendship.objects.filter(user=request.user, friend_id=user_id).exists()
        friendship2 = Friendship.objects.filter(user_id=user_id, friend=request.user).exists()
        if friendship1 or friendship2:
            return Response({
                'message': 'Friend'
            }, status=status.HTTP_200_OK)
        else:
            freienRequest=FriendRequest.objects.filter(sender=request.user,receiver_id=user_id,status=FriendRequest.PENDING).exists()
            if freienRequest:
                return Response({
                    'message': 'receiver'
                }, status=status.HTTP_200_OK)
            else:
                freienRequest=FriendRequest.objects.filter(sender_id=user_id,receiver=request.user,status=FriendRequest.PENDING).exists()
                if freienRequest:
                    return Response({
                        'message': 'sender'
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({
                        'message': 'none'
                    }, status=status.HTTP_200_OK)