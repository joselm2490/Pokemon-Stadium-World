from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/battles/', include('battles.urls')),
    path('api/pokedex/', include('pokedex.urls')),
]
