from django.urls import path
from .views import SendFriendRequestView ,AcceptFriendRequestView,CancelFriendRequestView,ListFriendsView\
                    ,ListReceivedFriendRequestsView,ListSentFriendRequestsView,UnfriendView ,UnreadNotificationsView ,ListNotificationsView,TypeOffriendship,RejectFriendRequestView

urlpatterns = [
    path('send/', SendFriendRequestView.as_view(), name='send'),
    path('accept/', AcceptFriendRequestView.as_view(), name='accept'),
    path('reject/', RejectFriendRequestView.as_view(), name='reject'),
    path('cancel/', CancelFriendRequestView.as_view(), name='cancel'),
    path('', ListFriendsView.as_view(), name='userfriend'),
    path('received/', ListReceivedFriendRequestsView.as_view(), name='received'),
    path('sended/', ListSentFriendRequestsView.as_view(), name='sended'),
    path('unfriend/', UnfriendView.as_view(), name='unfriend'),
    path('notifcation/', ListNotificationsView.as_view(), name='notification'),
    path('unread/', UnreadNotificationsView.as_view(), name='unread'),
    path('isfriend/', TypeOffriendship.as_view(), name='isfriend'),
    
]

