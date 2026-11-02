// auth.js – Handles registration, login, and UI widgets
// Requires bcryptjs (loaded via CDN) and supabase singleton (js/supabase.js)

import { supabase } from "./supabase.js";

// Simple AuthManager singleton
window.AuthManager = {
  currentUser: null,
  setUser(user) {
    this.currentUser = user;
    localStorage.setItem("psw_user", JSON.stringify(user));
    this.updateWidget();
  },
  clearUser() {
    this.currentUser = null;
    localStorage.removeItem("psw_user");
    this.updateWidget();
  },
  loadFromStorage() {
    const data = localStorage.getItem("psw_user");
    if (data) {
      this.currentUser = JSON.parse(data);
    }
    this.updateWidget();
  },
  updateWidget() {
    const widget = document.getElementById("userAuthWidget");
    if (!widget) return;
    widget.innerHTML = "";
    if (this.currentUser) {
      widget.innerHTML = `
        <span>👤 ${this.currentUser.nombre} ${this.currentUser.apellido}</span>
        <button id="logoutBtn">Cerrar sesión</button>
      `;
      document.getElementById("logoutBtn").addEventListener("click", () => this.logout());
    } else {
      widget.innerHTML = `
        <button id="showLoginBtn">Login</button>
        <button id="showRegisterBtn">Registrarse</button>
      `;
      document.getElementById("showLoginBtn").addEventListener("click", () => showModal("loginModal"));
      document.getElementById("showRegisterBtn").addEventListener("click", () => showModal("registerModal"));
    }
  },
  async register(event) {
    event.preventDefault();
    const nombre = document.getElementById("regNombre").value.trim();
    const apellido = document.getElementById("regApellido").value.trim();
    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirmPassword").value;
    if (password !== confirm) {
      alert("Las contraseñas no coinciden");
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from("usuarios").insert({
      nombre,
      apellido,
      username,
      email,
      contrasena: hash,
    });
    if (error) {
      alert("Error al registrar: " + error.message);
    } else {
      alert("Registrado con éxito");
      hideModal("registerModal");
      this.setUser({ id: data[0].id, nombre, apellido, username, email });
    }
  },
  async login(event) {
    event.preventDefault();
    const userOrEmail = document.getElementById("loginUserOrEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    // Try username first
    let { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre, apellido, username, email, contrasena")
      .eq("username", userOrEmail)
      .single();
    if (error) {
      // fallback email
      ({ data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, apellido, username, email, contrasena")
        .eq("email", userOrEmail)
        .single());
    }
    if (error || !data) {
      alert("Usuario no encontrado");
      return;
    }
    const match = await bcrypt.compare(password, data.contrasena);
    if (!match) {
      alert("Contraseña incorrecta");
      return;
    }
    this.setUser({ id: data.id, nombre: data.nombre, apellido: data.apellido, username: data.username, email: data.email });
    hideModal("loginModal");
  },
  async logout() {
    this.clearUser();
  },
};

function showModal(id) {
  document.getElementById(id).style.display = "block";
}
function hideModal(id) {
  document.getElementById(id).style.display = "none";
}

// Modal close handlers
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("closeRegister").addEventListener("click", () => hideModal("registerModal"));
  document.getElementById("closeLogin").addEventListener("click", () => hideModal("loginModal"));
  document.getElementById("registerForm").addEventListener("submit", (e) => AuthManager.register(e));
  document.getElementById("loginForm").addEventListener("submit", (e) => AuthManager.login(e));
  AuthManager.loadFromStorage();
});
