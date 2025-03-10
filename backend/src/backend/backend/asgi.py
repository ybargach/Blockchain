import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from friend.routing import websocket_urlpatterns as friend_websocket_urlpatterns
from game.routing import websocket_urlpatterns as game_websocket_urlpatterns
from tictac.routing import websocket_urlpatterns as tictac_websocket_urlpatterns
from friend.middleware import TokenAuthMiddleware  

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": TokenAuthMiddleware(
        URLRouter(
            friend_websocket_urlpatterns +   
            game_websocket_urlpatterns +    
            tictac_websocket_urlpatterns    
        )
    ),
})
