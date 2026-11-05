import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import BattleRooms, RoomPlayers, RoomMessages


class BattleLobbyConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for lobby and real-time battle synchronization.
    Route: ws://.../ws/room/<room_code>/
    """
    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code'].upper()
        self.room_group_name = f"battle_room_{self.room_code}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        room_data = await self.get_room_full_state(self.room_code)
        if room_data:
            await self.send(text_data=json.dumps({
                'type': 'room_state',
                'room': room_data
            }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except Exception:
            return

        action = data.get('action')

        if action == 'send_chat':
            sender = data.get('sender', 'Trainer')
            message = data.get('message', '').strip()
            if message:
                msg_obj = await self.save_message(self.room_code, sender, message, False)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': msg_obj
                    }
                )

        elif action == 'set_pokemon_count':
            count = int(data.get('count', 6))
            updated_room = await self.update_pokemon_count(self.room_code, count)
            if updated_room:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'room_updated',
                        'room': updated_room
                    }
                )

        elif action == 'player_ready':
            nickname = data.get('nickname')
            is_ready = bool(data.get('ready'))
            updated_room = await self.set_player_ready(self.room_code, nickname, is_ready)
            if updated_room:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'room_updated',
                        'room': updated_room
                    }
                )

        elif action == 'confirm_team':
            nickname = data.get('nickname')
            team = data.get('team', [])
            updated_room, both_confirmed = await self.confirm_player_team(self.room_code, nickname, team)
            if updated_room:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'room_updated',
                        'room': updated_room,
                        'both_confirmed': both_confirmed
                    }
                )

        elif action == 'battle_action':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_battle_action',
                    'action_data': data.get('payload')
                }
            )

    async def room_state(self, event):
        await self.send(text_data=json.dumps(event))

    async def room_updated(self, event):
        await self.send(text_data=json.dumps(event))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    async def broadcast_battle_action(self, event):
        await self.send(text_data=json.dumps({
            'type': 'battle_action',
            'payload': event['action_data']
        }))

    @database_sync_to_async
    def get_room_full_state(self, code):
        try:
            r = BattleRooms.objects.get(code=code)
            players = list(r.players_rel.values(
                'id', 'nickname', 'is_host', 'is_ready', 'is_connected', 'joined_at', 'pokemon_team'
            ))
            for j in players:
                j['is_host'] = bool(j['is_host'])
                j['is_ready'] = bool(j['is_ready'])
                j['is_connected'] = bool(j['is_connected'])
                if isinstance(j['pokemon_team'], str):
                    try:
                        j['pokemon_team'] = json.loads(j['pokemon_team'])
                    except Exception:
                        j['pokemon_team'] = []
                elif not j['pokemon_team']:
                    j['pokemon_team'] = []

            messages = list(r.messages_rel.order_by('id').values(
                'id', 'sender', 'message', 'is_system', 'sent_at'
            ))

            return {
                'id': r.id,
                'code': r.code,
                'host_name': r.host_name,
                'status': r.status,
                'pokemon_per_player': r.pokemon_per_player,
                'max_players': r.max_players,
                'current_players': len(players),
                'has_password': bool(r.password),
                'players': players,
                'messages': messages
            }
        except BattleRooms.DoesNotExist:
            return None

    @database_sync_to_async
    def save_message(self, code, sender, message, is_system):
        r = BattleRooms.objects.get(code=code)
        m = RoomMessages.objects.create(
            room=r,
            sender=sender,
            message=message,
            is_system=1 if is_system else 0,
            sent_at=timezone.now()
        )
        return {
            'id': m.id,
            'sender': m.sender,
            'message': m.message,
            'is_system': bool(m.is_system),
            'sent_at': m.sent_at.isoformat()
        }

    @database_sync_to_async
    def update_pokemon_count(self, code, count):
        r = BattleRooms.objects.get(code=code)
        r.pokemon_per_player = max(1, min(6, count))
        r.save()
        return self._serialize_room_sync(r)

    @database_sync_to_async
    def set_player_ready(self, code, nickname, is_ready):
        r = BattleRooms.objects.get(code=code)
        p = r.players_rel.filter(nickname__iexact=nickname).first()
        if p:
            p.is_ready = 1 if is_ready else 0
            p.save()
        return self._serialize_room_sync(r)

    @database_sync_to_async
    def confirm_player_team(self, code, nickname, team):
        r = BattleRooms.objects.get(code=code)
        p = r.players_rel.filter(nickname__iexact=nickname).first()
        if p:
            p.pokemon_team = json.dumps(team)
            p.is_ready = 1
            p.save()

        players = list(r.players_rel.all())
        both = len(players) >= 2 and all(bool(j.is_ready and j.pokemon_team) for j in players)
        if both and r.status == 'waiting':
            r.status = 'in_battle'
            r.started_at = timezone.now()
            r.save()

        return self._serialize_room_sync(r), both

    def _serialize_room_sync(self, r):
        players = list(r.players_rel.values(
            'id', 'nickname', 'is_host', 'is_ready', 'is_connected', 'joined_at', 'pokemon_team'
        ))
        for j in players:
            j['is_host'] = bool(j['is_host'])
            j['is_ready'] = bool(j['is_ready'])
            j['is_connected'] = bool(j['is_connected'])
            if isinstance(j['pokemon_team'], str):
                try:
                    j['pokemon_team'] = json.loads(j['pokemon_team'])
                except Exception:
                    j['pokemon_team'] = []
            elif not j['pokemon_team']:
                j['pokemon_team'] = []

        return {
            'id': r.id,
            'code': r.code,
            'host_name': r.host_name,
            'status': r.status,
            'pokemon_per_player': r.pokemon_per_player,
            'max_players': r.max_players,
            'current_players': len(players),
            'has_password': bool(r.password),
            'players': players
        }
