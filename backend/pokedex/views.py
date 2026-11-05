import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from battles.models import Pokemon, Moves, Types


@require_http_methods(["GET"])
def list_pokemon(request):
    """
    GET /api/pokedex/pokemon/
    Query params: ?gen=1&is_champion=1&search=pika&limit=100&offset=0
    """
    qs = Pokemon.objects.all()

    gen = request.GET.get('gen')
    if gen and gen != 'all':
        try:
            qs = qs.filter(gen=int(gen))
        except ValueError:
            pass

    champion = request.GET.get('is_champion') or request.GET.get('campeon')
    if champion is not None:
        try:
            qs = qs.filter(is_champion=int(champion))
        except ValueError:
            pass

    search = request.GET.get('search')
    if search:
        qs = qs.filter(name__icontains=search.strip())

    limit = min(int(request.GET.get('limit', 100)), 300)
    offset = int(request.GET.get('offset', 0))

    total = qs.count()
    items = list(qs.order_by('pokedex_number')[offset:offset+limit].values(
        'id', 'pokedex_number', 'name', 'name_en', 'gen', 'type1__name', 'type2__name', 'is_champion', 'stage'
    ))

    data = []
    for p in items:
        data.append({
            'id': p['id'],
            'pokedex_number': p['pokedex_number'],
            'name': p['name'],
            'name_en': p['name_en'],
            'gen': p['gen'],
            'type1': p['type1__name'],
            'type2': p['type2__name'],
            'is_champion': p['is_champion'],
            'stage': p['stage']
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
                'pokedex_number': p.pokedex_number,
                'name': p.name,
                'name_en': p.name_en,
                'gen': p.gen,
                'type1': p.type1.name if p.type1 else None,
                'type2': p.type2.name if p.type2 else None,
                'weight_kg': p.weight_kg,
                'height_m': p.height_m,
                'is_champion': p.is_champion,
                'stage': p.stage,
                'rarity': p.rarity
            }
        })
    except Pokemon.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Pokemon not found'}, status=404)


@require_http_methods(["GET"])
def list_moves(request):
    """
    GET /api/pokedex/moves/
    """
    qs = Moves.objects.all()

    category = request.GET.get('category') or request.GET.get('clase')
    if category and category != 'all':
        qs = qs.filter(category__iexact=category.strip())

    search = request.GET.get('search')
    if search:
        qs = qs.filter(name__icontains=search.strip())

    limit = min(int(request.GET.get('limit', 100)), 500)
    offset = int(request.GET.get('offset', 0))

    total = qs.count()
    items = list(qs.order_by('id')[offset:offset+limit].values(
        'id', 'code', 'name', 'name_en', 'gen', 'type_name', 'category', 'power', 'accuracy', 'pp', 'priority'
    ))

    return JsonResponse({
        'ok': True,
        'total': total,
        'limit': limit,
        'offset': offset,
        'data': items
    })
