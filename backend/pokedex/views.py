import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from battles.models import Pokemon, Movimientos, Tipos


@require_http_methods(["GET"])
def list_pokemon(request):
    """
    GET /api/pokedex/pokemon/
    Filtros: ?gen=1&campeon=1&tipo=fuego&search=pika&limit=50&offset=0
    """
    qs = Pokemon.objects.all()

    gen = request.GET.get('gen')
    if gen and gen != 'todas':
        try:
            qs = qs.filter(gen=int(gen))
        except ValueError:
            pass

    campeon = request.GET.get('campeon')
    if campeon is not None:
        try:
            qs = qs.filter(campeon=int(campeon))
        except ValueError:
            pass

    search = request.GET.get('search')
    if search:
        qs = qs.filter(nombre__icontains=search.strip())

    limit = min(int(request.GET.get('limit', 100)), 300)
    offset = int(request.GET.get('offset', 0))

    total = qs.count()
    items = list(qs.order_by('numero_pokedex')[offset:offset+limit].values(
        'id', 'numero_pokedex', 'nombre', 'nombre_ingles', 'gen', 'tipo1__nombre', 'tipo2__nombre', 'campeon', 'fase'
    ))

    data = []
    for p in items:
        data.append({
            'id': p['id'],
            'numero_pokedex': p['numero_pokedex'],
            'nombre': p['nombre'],
            'nombre_ingles': p['nombre_ingles'],
            'gen': p['gen'],
            'tipo1': p['tipo1__nombre'],
            'tipo2': p['tipo2__nombre'],
            'campeon': p['campeon'],
            'fase': p['fase']
        })

    return JsonResponse({
        'ok': True,
        'total': total,
        'limit': limit,
        'offset': offset,
        'data': data
    })


@require_http_methods(["GET"])
def get_pokemon_detail(request, pk):
    """
    GET /api/pokedex/pokemon/<id>/
    """
    try:
        p = Pokemon.objects.get(id=pk)
        return JsonResponse({
            'ok': True,
            'data': {
                'id': p.id,
                'numero_pokedex': p.numero_pokedex,
                'nombre': p.nombre,
                'nombre_ingles': p.nombre_ingles,
                'gen': p.gen,
                'tipo1': p.tipo1.nombre if p.tipo1 else None,
                'tipo2': p.tipo2.nombre if p.tipo2 else None,
                'campeon': p.campeon,
                'fase': p.fase,
                'categoria_rareza': p.categoria_rareza
            }
        })
    except Pokemon.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Pokémon no encontrado'}, status=404)


@require_http_methods(["GET"])
def list_movimientos(request):
    """
    GET /api/pokedex/movimientos/
    """
    qs = Movimientos.objects.all()

    tipo = request.GET.get('tipo')
    if tipo and tipo != 'todos':
        qs = qs.filter(tipo__iexact=tipo.strip())

    clase = request.GET.get('clase')
    if clase and clase != 'todas':
        qs = qs.filter(clase__iexact=clase.strip())

    search = request.GET.get('search')
    if search:
        qs = qs.filter(nombre__icontains=search.strip())

    limit = min(int(request.GET.get('limit', 100)), 500)
    offset = int(request.GET.get('offset', 0))

    total = qs.count()
    items = list(qs.order_by('id')[offset:offset+limit].values(
        'id', 'codigo', 'nombre', 'nombre_ingles', 'gen', 'tipo', 'clase', 'potencia', 'precision', 'pp', 'prioridad'
    ))

    return JsonResponse({
        'ok': True,
        'total': total,
        'limit': limit,
        'offset': offset,
        'data': items
    })
