from django.urls import path
from . import views

urlpatterns = [
    path('rooms/', views.list_available_rooms, name='list_available_rooms'),
    path('rooms/<str:code>/', views.get_room_details, name='get_room_details'),
]
