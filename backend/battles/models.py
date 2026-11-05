from django.db import models


class Types(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50)
    name_en = models.CharField(max_length=50, blank=True, null=True)
    color_hex = models.CharField(max_length=10, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'types'
        verbose_name_plural = 'Types'

    def __str__(self):
        return self.name


class MoveClasses(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50)
    name_en = models.CharField(max_length=50, blank=True, null=True)
    color_hex = models.CharField(max_length=10, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'move_classes'
        verbose_name_plural = 'Move Classes'

    def __str__(self):
        return self.name


class Pokemon(models.Model):
    id = models.IntegerField(primary_key=True)
    pokedex_number = models.IntegerField()
    name = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    gen = models.IntegerField()
    type1 = models.ForeignKey(Types, models.DO_NOTHING, db_column='type1_id', related_name='pokemon_type1')
    type2 = models.ForeignKey(Types, models.DO_NOTHING, db_column='type2_id', related_name='pokemon_type2', blank=True, null=True)
    weight_kg = models.FloatField(blank=True, null=True)
    height_m = models.FloatField(blank=True, null=True)
    catch_rate = models.IntegerField(blank=True, null=True)
    base_experience = models.IntegerField(blank=True, null=True)
    growth_rate = models.CharField(max_length=50, blank=True, null=True)
    default_moves = models.TextField(blank=True, null=True)
    rarity = models.CharField(max_length=50, blank=True, null=True)
    pre_evolution_id = models.IntegerField(blank=True, null=True)
    evolution_id = models.IntegerField(blank=True, null=True)
    is_champion = models.IntegerField(default=0)
    stage = models.IntegerField(default=1)

    class Meta:
        managed = False
        db_table = 'pokemon'
        verbose_name_plural = 'Pokémon'

    def __str__(self):
        return f"#{self.pokedex_number} {self.name}"


class Moves(models.Model):
    id = models.IntegerField(primary_key=True)
    code = models.CharField(unique=True, max_length=100)
    name = models.CharField(max_length=100)
    name_alt = models.CharField(max_length=100, blank=True, null=True)
    name_en = models.CharField(max_length=100)
    gen = models.IntegerField()
    description = models.TextField(blank=True, null=True)
    type_id = models.IntegerField(blank=True, null=True)
    type_name = models.CharField(max_length=50, blank=True, null=True)
    move_class_id = models.IntegerField(blank=True, null=True)
    category = models.CharField(max_length=50, blank=True, null=True)
    power = models.IntegerField(blank=True, null=True)
    accuracy = models.IntegerField(blank=True, null=True)
    pp = models.IntegerField(blank=True, null=True)
    priority = models.IntegerField(default=0)
    is_gigamax = models.IntegerField(default=0)
    is_z_move = models.IntegerField(default=0)
    makes_contact = models.IntegerField(default=0)
    effect_chance = models.IntegerField(blank=True, null=True)
    secondary_effect = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'moves'
        verbose_name_plural = 'Moves'

    def __str__(self):
        return self.name


class BattleRooms(models.Model):
    id = models.BigAutoField(primary_key=True)
    code = models.CharField(unique=True, max_length=20)
    host_id = models.IntegerField(blank=True, null=True)
    host_name = models.CharField(max_length=100)
    status = models.CharField(max_length=30, default='waiting') # 'waiting', 'in_battle', 'finished', 'cancelled'
    pokemon_per_player = models.IntegerField(default=6)
    max_players = models.IntegerField(default=2)
    current_players = models.IntegerField(default=1)
    winner_name = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)
    password = models.CharField(max_length=100, blank=True, null=True)
    players = models.TextField(blank=True, null=True) # JSON serialized backup
    settings = models.TextField(blank=True, null=True) # JSON serialized settings

    class Meta:
        managed = False
        db_table = 'battle_rooms'
        verbose_name_plural = 'Battle Rooms'

    def __str__(self):
        return f"Room [{self.code}] ({self.status}) - Host: {self.host_name}"


class RoomPlayers(models.Model):
    id = models.BigAutoField(primary_key=True)
    room = models.ForeignKey(BattleRooms, models.CASCADE, db_column='room_id', related_name='players_rel')
    user_id = models.IntegerField(blank=True, null=True)
    nickname = models.CharField(max_length=100)
    is_host = models.IntegerField(default=0)
    pokemon_team = models.TextField(blank=True, null=True)
    is_ready = models.IntegerField(default=0)
    is_connected = models.IntegerField(default=1)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'room_players'
        unique_together = (('room', 'nickname'),)
        verbose_name_plural = 'Room Players'

    def __str__(self):
        return f"{self.nickname} in Room {self.room.code}"


class RoomMessages(models.Model):
    id = models.BigAutoField(primary_key=True)
    room = models.ForeignKey(BattleRooms, models.CASCADE, db_column='room_id', related_name='messages_rel')
    sender = models.CharField(max_length=100)
    message = models.TextField()
    is_system = models.IntegerField(default=0)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'room_messages'
        verbose_name_plural = 'Room Messages'

    def __str__(self):
        return f"[{self.room.code}] {self.sender}: {self.message[:30]}"
