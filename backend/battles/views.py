import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import SalasBatalla, SalaJugadores, SalaMensajes


@require_http_methods(["GET"])
def list_available_rooms(request):
    """
    GET /api/battles/rooms/
    Lista de salas disponibles en estado esperando
    """
    rooms = SalasBatalla.objects.filter(estado__in=['esperando', 'en_combate']).order_by('-id')[:30]
    data = []
    for r in rooms:
        data.append({
            'id': r.id,
            'codigo': r.codigo,
            'anfitrion_nombre': r.anfitrion_nombre,
            'estado': r.estado,
            'pokemon_por_jugador': r.pokemon_por_jugador,
            'max_jugadores': r.max_jugadores,
            'jugadores_actuales': r.jugadores_actuales,
            'tiene_contrasena': bool(r.contrasena),
            'creada_en': r.creada_en.isoformat() if r.creada_en else None
        })
    return JsonResponse({'ok': True, 'data': data})


@require_http_methods(["GET"])
def get_room_details(request, code):
    """
    GET /api/battles/rooms/<codigo>/
    Detalles completos de una sala
    """
    clean_code = code.strip().upper()
    try:
        r = SalasBatalla.objects.get(codigo=clean_code)
        jugadores = list(r.jugadores_rel.values(
            'id', 'apodo', 'es_anfitrion', 'listo', 'conectado', 'unido_en', 'equipo_pokemon'
        ))
        mensajes = list(r.mensajes_rel.order_by('id').values(
            'id', 'emisor', 'mensaje', 'es_sistema', 'enviado_en'
        ))
        return JsonResponse({
            'ok': True,
            'data': {
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
        })
    except SalasBatalla.DoesNotExist:
        return JsonResponse({'ok': False, 'error': f'No existe sala con código {clean_code}'}, status=404)
