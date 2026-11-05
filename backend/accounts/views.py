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
    Body: {"username": "...", "email": "...", "password": "...", "first_name": "..."}
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
    """
    Endpoint de Logout en Django
    POST /api/auth/logout/
    """
    logout(request)
    return JsonResponse({"ok": True, "message": "Sesión cerrada exitosamente."})


@require_http_methods(["GET"])
def api_current_user(request):
    """
    Verificar sesión activa en Django
    GET /api/auth/me/
    """
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
