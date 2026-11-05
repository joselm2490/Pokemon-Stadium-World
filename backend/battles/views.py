import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .models import BattleRooms, RoomPlayers, RoomMessages


@require_http_methods(["GET"])
def list_available_rooms(request):
    """
    GET /api/battles/rooms/
    """
    rooms = BattleRooms.objects.filter(status__in=['waiting', 'in_battle']).order_by('-id')[:30]
    data = []
    for r in rooms:
        data.append({
            'id': r.id,
            'code': r.code,
            'host_name': r.host_name,
            'status': r.status,
            'pokemon_per_player': r.pokemon_per_player,
            'max_players': r.max_players,
            'current_players': r.current_players,
            'has_password': bool(r.password),
            'created_at': r.created_at.isoformat() if r.created_at else None
        })
    return JsonResponse({'ok': True, 'data': data})


@require_http_methods(["GET"])
def get_room_details(request, code):
    """
    GET /api/battles/rooms/<code_or_id>/
    """
    clean_code = code.strip().upper()
    try:
        r = BattleRooms.objects.get(code=clean_code)
        players = list(r.players_rel.values(
            'id', 'nickname', 'is_host', 'is_ready', 'is_connected', 'joined_at', 'pokemon_team'
        ))
        messages = list(r.messages_rel.order_by('id').values(
            'id', 'sender', 'message', 'is_system', 'sent_at'
        ))
        return JsonResponse({
            'ok': True,
            'data': {
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
        })
    except BattleRooms.DoesNotExist:
        return JsonResponse({'ok': False, 'error': f'Room {clean_code} not found'}, status=404)
