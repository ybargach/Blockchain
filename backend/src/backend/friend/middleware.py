from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

User = get_user_model()

@database_sync_to_async
def get_user(token_key):
    try:
        access_token = AccessToken(token_key)
        user = User.objects.get(id=access_token['user_id'])
        return user
    except Exception as e:
        return AnonymousUser()

class TokenAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # Extract the query string from the scope
        query_string = scope.get('query_string', b'').decode('utf-8')
        token = None

        # Extract the token from the query string (e.g., "token=<value>")
        for part in query_string.split('&'):
            if part.startswith('token='):
                token = part.split('=')[1]
                break
        # If a token is found, get the user
        if token:
            scope['user'] = await get_user(token)
        else:
            # No valid token, set as anonymous user
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)