from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/status/', consumers.UserStatusConsumer.as_asgi()),
    re_path(r'ws/notifcation/', consumers.UserNotificationCunsomer.as_asgi()),
]