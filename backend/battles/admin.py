from django.contrib import admin
from .models import BattleRooms, RoomPlayers, RoomMessages, Pokemon, Moves, Types, MoveClasses


@admin.register(BattleRooms)
class BattleRoomsAdmin(admin.ModelAdmin):
    list_display = ('code', 'host_name', 'status', 'pokemon_per_player', 'current_players', 'created_at')
    list_filter = ('status', 'pokemon_per_player')
    search_fields = ('code', 'host_name')


@admin.register(RoomPlayers)
class RoomPlayersAdmin(admin.ModelAdmin):
    list_display = ('nickname', 'room', 'is_host', 'is_ready', 'is_connected', 'joined_at')
    list_filter = ('is_host', 'is_ready', 'is_connected')
    search_fields = ('nickname', 'room__code')


@admin.register(RoomMessages)
class RoomMessagesAdmin(admin.ModelAdmin):
    list_display = ('room', 'sender', 'message', 'is_system', 'sent_at')
    search_fields = ('sender', 'message', 'room__code')


@admin.register(Pokemon)
class PokemonAdmin(admin.ModelAdmin):
    list_display = ('pokedex_number', 'name', 'gen', 'type1', 'type2', 'is_champion', 'stage')
    list_filter = ('gen', 'is_champion', 'stage', 'type1')
    search_fields = ('name', 'pokedex_number')


@admin.register(Moves)
class MovesAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'category', 'power', 'accuracy', 'pp')
    list_filter = ('category', 'gen')
    search_fields = ('name', 'code')
