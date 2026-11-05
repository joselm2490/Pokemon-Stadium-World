import json
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

User = get_user_model()


@csrf_exempt
@require_http_methods(["POST"])
def api_login(request):
    """
    Endpoint de Login en Django
    POST /api/auth/login/
    Body: {"username": "...", "password": "..."}
    """
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({"ok": False, "error": "Formato JSON inválido."}, status=400)

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return JsonResponse({"ok": False, "error": "Debes ingresar usuario y contraseña."}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return JsonResponse({
            "ok": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser
            }
        })
    else:
        return JsonResponse({"ok": False, "error": "Usuario o contraseña incorrectos."}, status=401)


@csrf_exempt
@require_http_methods(["POST"])
def api_register(request):
    """
    Endpoint de Registro en Django
    POST /api/auth/register/
    """
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({"ok": False, "error": "Formato JSON inválido."}, status=400)

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    first_name = (data.get("nombre") or data.get("first_name") or "").strip()

    if not username or not password:
        return JsonResponse({"ok": False, "error": "Usuario y contraseña son requeridos."}, status=400)

    if len(password) < 6:
        return JsonResponse({"ok": False, "error": "La contraseña debe tener al menos 6 caracteres."}, status=400)

    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({"ok": False, "error": f"El nombre de usuario '{username}' ya está registrado."}, status=400)

    if email and User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"ok": False, "error": "Este correo electrónico ya está registrado."}, status=400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name
    )

    login(request, user)
    return JsonResponse({
        "ok": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser
        }
    })


@csrf_exempt
@require_http_methods(["POST", "GET"])
def api_logout(request):
    logout(request)
    return JsonResponse({"ok": True, "message": "Sesión cerrada exitosamente."})


@require_http_methods(["GET"])
def api_current_user(request):
    if request.user.is_authenticated:
        return JsonResponse({
            "ok": True,
            "is_authenticated": True,
            "user": {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "is_staff": request.user.is_staff,
                "is_superuser": request.user.is_superuser
            }
        })
    return JsonResponse({"ok": True, "is_authenticated": False, "user": None})


@require_http_methods(["GET"])
def api_list_users_admin(request):
    """
    VISTA PROTEGIDA EXCLUSIVA PARA SUPERUSUARIO
    GET /api/auth/users/
    Solo accesible si el usuario autenticado tiene is_superuser == True
    """
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({
            "ok": False,
            "error": "Acceso denegado. Se requieren permisos de superusuario para ver este módulo."
        }, status=403)

    users = User.objects.all().order_by('-date_joined')
    data = []
    for u in users:
        data.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "is_active": u.is_active,
            "is_staff": u.is_staff,
            "is_superuser": u.is_superuser,
            "date_joined": u.date_joined.isoformat() if u.date_joined else None,
            "last_login": u.last_login.isoformat() if u.last_login else None
        })

    return JsonResponse({
        "ok": True,
        "total": len(data),
        "data": data
    })
