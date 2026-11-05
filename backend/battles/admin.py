from django.contrib import admin
from .models import SalasBatalla, SalaJugadores, SalaMensajes, Pokemon, Movimientos, Tipos, ClasesMovimiento


@admin.register(SalasBatalla)
class SalasBatallaAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'anfitrion_nombre', 'estado', 'pokemon_por_jugador', 'jugadores_actuales', 'creada_en')
    list_filter = ('estado', 'pokemon_por_jugador')
    search_fields = ('codigo', 'anfitrion_nombre')


@admin.register(SalaJugadores)
class SalaJugadoresAdmin(admin.ModelAdmin):
    list_display = ('apodo', 'sala', 'es_anfitrion', 'listo', 'conectado', 'unido_en')
    list_filter = ('es_anfitrion', 'listo', 'conectado')
    search_fields = ('apodo', 'sala__codigo')


@admin.register(SalaMensajes)
class SalaMensajesAdmin(admin.ModelAdmin):
    list_display = ('sala', 'emisor', 'mensaje', 'es_sistema', 'enviado_en')
    search_fields = ('emisor', 'mensaje', 'sala__codigo')


@admin.register(Pokemon)
class PokemonAdmin(admin.ModelAdmin):
    list_display = ('numero_pokedex', 'nombre', 'gen', 'tipo1', 'tipo2', 'campeon', 'fase')
    list_filter = ('gen', 'campeon', 'fase', 'tipo1')
    search_fields = ('nombre', 'numero_pokedex')


@admin.register(Movimientos)
class MovimientosAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nombre', 'tipo', 'clase', 'potencia', 'precision', 'pp')
    list_filter = ('tipo', 'clase', 'gen')
    search_fields = ('nombre', 'codigo')
