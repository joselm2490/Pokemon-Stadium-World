import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import SalasBatalla, SalaJugadores, SalaMensajes


class BattleLobbyConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket para la sala de espera y sincronización en tiempo real.
    Ruta: ws://.../ws/sala/<codigo>/
    """
    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code'].upper()
        self.room_group_name = f"battle_room_{self.room_code}"

        # Unirse al grupo del room
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Enviar el estado actual de la sala de inmediato al nuevo cliente
        room_data = await self.get_room_full_state(self.room_code)
        if room_data:
            await self.send(text_data=json.dumps({
                'type': 'room_state',
                'room': room_data
            }))

    async def disconnect(self, close_code):
        # Salir del grupo
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
            sender = data.get('sender', 'Entrenador')
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
            # Reenvía acciones de turno de batalla (movimiento, relevo) al rival en tiempo real
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_battle_action',
                    'action_data': data.get('payload')
                }
            )

    # Handlers de eventos de grupo
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

    # Operaciones asíncronas con base de datos
    @database_sync_to_async
    def get_room_full_state(self, code):
        try:
            r = SalasBatalla.objects.get(codigo=code)
            jugadores = list(r.jugadores_rel.values(
                'id', 'apodo', 'es_anfitrion', 'listo', 'conectado', 'unido_en', 'equipo_pokemon'
            ))
            # Parsear equipo_pokemon si es string
            for j in jugadores:
                j['es_anfitrion'] = bool(j['es_anfitrion'])
                j['listo'] = bool(j['listo'])
                j['conectado'] = bool(j['conectado'])
                if isinstance(j['equipo_pokemon'], str):
                    try:
                        j['equipo_pokemon'] = json.loads(j['equipo_pokemon'])
                    except Exception:
                        j['equipo_pokemon'] = []
                elif not j['equipo_pokemon']:
                    j['equipo_pokemon'] = []

            mensajes = list(r.mensajes_rel.order_by('id').values(
                'id', 'emisor', 'mensaje', 'es_sistema', 'enviado_en'
            ))

            return {
                'id': r.id,
                'codigo': r.codigo,
                'anfitrion_nombre': r.anfitrion_nombre,
                'estado': r.estado,
                'pokemon_por_jugador': r.pokemon_por_jugador,
                'max_jugadores': r.max_jugadores,
                'jugadores_actuales': len(jugadores),
                'tiene_contrasena': bool(r.contrasena),
                'jugadores': jugadores,
                'mensajes': mensajes
            }
        except SalasBatalla.DoesNotExist:
            return None

    @database_sync_to_async
    def save_message(self, code, sender, message, is_system):
        r = SalasBatalla.objects.get(codigo=code)
        m = SalaMensajes.objects.create(
            sala=r,
            emisor=sender,
            mensaje=message,
            es_sistema=1 if is_system else 0,
            enviado_en=timezone.now()
        )
        return {
            'id': m.id,
            'emisor': m.emisor,
            'mensaje': m.mensaje,
            'es_sistema': bool(m.es_sistema),
            'enviado_en': m.enviado_en.isoformat()
        }

    @database_sync_to_async
    def update_pokemon_count(self, code, count):
        r = SalasBatalla.objects.get(codigo=code)
        r.pokemon_por_jugador = max(1, min(6, count))
        r.save()
        return self._serialize_room_sync(r)

    @database_sync_to_async
    def set_player_ready(self, code, nickname, is_ready):
        r = SalasBatalla.objects.get(codigo=code)
        p = r.jugadores_rel.filter(apodo__iexact=nickname).first()
        if p:
            p.listo = 1 if is_ready else 0
            p.save()
        return self._serialize_room_sync(r)

    @database_sync_to_async
    def confirm_player_team(self, code, nickname, team):
        r = SalasBatalla.objects.get(codigo=code)
        p = r.jugadores_rel.filter(apodo__iexact=nickname).first()
        if p:
            p.equipo_pokemon = json.dumps(team)
            p.listo = 1
            p.save()

        # Comprobar si ambos están listos con equipo
        jugadores = list(r.jugadores_rel.all())
        both = len(jugadores) >= 2 and all(bool(j.listo and j.equipo_pokemon) for j in jugadores)
        if both and r.estado == 'esperando':
            r.estado = 'en_combate'
            r.iniciada_en = timezone.now()
            r.save()

        return self._serialize_room_sync(r), both

    def _serialize_room_sync(self, r):
        jugadores = list(r.jugadores_rel.values(
            'id', 'apodo', 'es_anfitrion', 'listo', 'conectado', 'unido_en', 'equipo_pokemon'
        ))
        for j in jugadores:
            j['es_anfitrion'] = bool(j['es_anfitrion'])
            j['listo'] = bool(j['listo'])
            j['conectado'] = bool(j['conectado'])
            if isinstance(j['equipo_pokemon'], str):
                try:
                    j['equipo_pokemon'] = json.loads(j['equipo_pokemon'])
                except Exception:
                    j['equipo_pokemon'] = []
            elif not j['equipo_pokemon']:
                j['equipo_pokemon'] = []

        return {
            'id': r.id,
            'codigo': r.codigo,
            'anfitrion_nombre': r.anfitrion_nombre,
            'estado': r.estado,
            'pokemon_por_jugador': r.pokemon_por_jugador,
            'max_jugadores': r.max_jugadores,
            'jugadores_actuales': len(jugadores),
            'tiene_contrasena': bool(r.contrasena),
            'jugadores': jugadores
        }
