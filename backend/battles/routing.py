from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/sala/(?P<room_code>\w+)/$', consumers.BattleLobbyConsumer.as_asgi()),
]
