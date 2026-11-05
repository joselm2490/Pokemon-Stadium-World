from django.db import models


class Tipos(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=50)

    class Meta:
        managed = False
        db_table = 'tipos'

    def __str__(self):
        return self.nombre


class ClasesMovimiento(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=50)

    class Meta:
        managed = False
        db_table = 'clases_movimiento'

    def __str__(self):
        return self.nombre


class Pokemon(models.Model):
    id = models.IntegerField(primary_key=True)
    numero_pokedex = models.IntegerField()
    nombre = models.CharField(max_length=100)
    nombre_ingles = models.CharField(max_length=100)
    gen = models.IntegerField()
    tipo1 = models.ForeignKey(Tipos, models.DO_NOTHING, db_column='tipo1_id', related_name='pokemon_tipo1')
    tipo2 = models.ForeignKey(Tipos, models.DO_NOTHING, db_column='tipo2_id', related_name='pokemon_tipo2', blank=True, null=True)
    campeon = models.IntegerField(default=0)
    fase = models.IntegerField(default=1)
    categoria_rareza = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'pokemon'
        verbose_name_plural = 'Pokémon'

    def __str__(self):
        return f"#{self.numero_pokedex} {self.nombre}"


class Movimientos(models.Model):
    id = models.IntegerField(primary_key=True)
    codigo = models.CharField(unique=True, max_length=100)
    nombre = models.CharField(max_length=100)
    nombre_ingles = models.CharField(max_length=100)
    gen = models.IntegerField()
    tipo = models.CharField(max_length=50, blank=True, null=True)
    clase = models.CharField(max_length=50, blank=True, null=True)
    potencia = models.IntegerField(blank=True, null=True)
    precision = models.IntegerField(blank=True, null=True)
    pp = models.IntegerField(blank=True, null=True)
    prioridad = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = 'movimientos'
        verbose_name_plural = 'Movimientos'

    def __str__(self):
        return self.nombre


class SalasBatalla(models.Model):
    id = models.BigAutoField(primary_key=True)
    codigo = models.CharField(unique=True, max_length=20)
    anfitrion_nombre = models.CharField(max_length=100)
    estado = models.CharField(max_length=30, default='esperando') # 'esperando', 'en_combate', 'finalizada', 'cancelada'
    pokemon_por_jugador = models.IntegerField(default=6)
    max_jugadores = models.IntegerField(default=2)
    jugadores_actuales = models.IntegerField(default=1)
    ganador_nombre = models.CharField(max_length=100, blank=True, null=True)
    creada_en = models.DateTimeField(auto_now_add=True)
    iniciada_en = models.DateTimeField(blank=True, null=True)
    finalizada_en = models.DateTimeField(blank=True, null=True)
    contrasena = models.CharField(max_length=100, blank=True, null=True)
    jugadores = models.TextField(blank=True, null=True) # JSON serializado de respaldo
    ajustes = models.TextField(blank=True, null=True)   # JSON serializado

    class Meta:
        managed = False
        db_table = 'salas_batalla'
        verbose_name_plural = 'Salas de Batalla'

    def __str__(self):
        return f"Sala [{self.codigo}] ({self.estado}) - Anfitrión: {self.anfitrion_nombre}"


class SalaJugadores(models.Model):
    id = models.BigAutoField(primary_key=True)
    sala = models.ForeignKey(SalasBatalla, models.CASCADE, related_name='jugadores_rel')
    apodo = models.CharField(max_length=100)
    es_anfitrion = models.IntegerField(default=0)
    equipo_pokemon = models.TextField(blank=True, null=True)
    listo = models.IntegerField(default=0)
    conectado = models.IntegerField(default=1)
    unido_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'sala_jugadores'
        unique_together = (('sala', 'apodo'),)
        verbose_name_plural = 'Jugadores en Sala'

    def __str__(self):
        return f"{self.apodo} en Sala {self.sala.codigo}"


class SalaMensajes(models.Model):
    id = models.BigAutoField(primary_key=True)
    sala = models.ForeignKey(SalasBatalla, models.CASCADE, related_name='mensajes_rel')
    emisor = models.CharField(max_length=100)
    mensaje = models.TextField()
    es_sistema = models.IntegerField(default=0)
    enviado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'sala_mensajes'
        verbose_name_plural = 'Mensajes de Sala'

    def __str__(self):
        return f"[{self.sala.codigo}] {self.emisor}: {self.mensaje[:30]}"
