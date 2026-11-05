from django.urls import path
from . import views

urlpatterns = [
    path('pokemon/', views.list_pokemon, name='list_pokemon'),
    path('pokemon/<int:pk>/', views.get_pokemon_detail, name='get_pokemon_detail'),
    path('moves/', views.list_moves, name='list_moves'),
]
