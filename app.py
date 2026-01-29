from flask import Flask, render_template_string, request, redirect, session
from functools import wraps
from datetime import datetime
from supabase import create_client
import os

# =====================
# CONFIG
# =====================
app = Flask(__name__)
app.secret_key = "gincana_hs"

META = 2000

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# =====================
# AUTH
# =====================
def login_required(perfis=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if "user" not in session:
                return redirect("/")
            user = supabase.table("users").select("*").eq("username", session["user"]).execute().data[0]
            if perfis and user["perfil"] not in perfis:
                return redirect("/dashboard")
            return f(*args, **kwargs)
        return wrapper
    return decorator

# =====================
# LOGIN
# =====================
LOGIN_HTML = """<html><body style="background:#000;color:white">
<form method="post">
<input name="user" placeholder="Usuário">
<input name="senha" type="password" placeholder="Senha">
<button>Entrar</button>
</form>
</body></html>"""

@app.route("/", methods=["GET","POST"])
def login():
    if request.method == "POST":
        u = request.form["user"]
        s = request.form["senha"]
        r = supabase.table("users").select("*").eq("username", u).eq("senha", s).execute()
        if r.data:
            session["user"] = u
            return redirect("/dashboard")
    return render_template_string(LOGIN_HTML)

# =====================
# DASHBOARD
# =====================
@app.route("/dashboard")
@login_required()
def dashboard():
    equipes = supabase.table("equipes").select("*").execute().data
    return render_template_string("""
    <h1>Placar</h1>
    {% for e in equipes %}
    <p>{{e.nome}} — {{e.pontos}} pts — R$ {{e.valor}}</p>
    {% endfor %}
    <a href="/logout">Sair</a>
    """, equipes=equipes)

# =====================
# EVENTOS
# =====================
@app.route("/eventos", methods=["GET","POST"])
@login_required(["Administrador","Líder"])
def eventos():
    if request.method == "POST":
        supabase.table("eventos").insert({
            "nome": request.form["nome"],
            "pontos": int(request.form["pontos"]),
            "equipe": request.form["equipe"],
            "data": datetime.now().strftime("%d/%m/%Y")
        }).execute()

        supabase.rpc("increment_pontos", {
            "team": request.form["equipe"],
            "pts": int(request.form["pontos"])
        }).execute()

        return redirect("/eventos")

    eventos = supabase.table("eventos").select("*").execute().data
    return render_template_string("""
    <form method="post">
    <input name="nome">
    <input name="pontos" type="number">
    <select name="equipe"><option>Meninos</option><option>Meninas</option></select>
    <button>Cadastrar</button>
    </form>
    {% for e in eventos %}
    <p>{{e.nome}} - {{e.pontos}} - {{e.equipe}}</p>
    {% endfor %}
    """, eventos=eventos)

# =====================
# FINANCEIRO
# =====================
@app.route("/financeiro", methods=["GET","POST"])
@login_required(["Administrador","Líder"])
def financeiro():
    if request.method == "POST":
        supabase.table("financeiro").insert({
            "data": request.form["data"],
            "nome": request.form["nome"],
            "valor": float(request.form["valor"]),
            "equipe": request.form["equipe"]
        }).execute()

        supabase.rpc("increment_valor", {
            "team": request.form["equipe"],
            "val": float(request.form["valor"])
        }).execute()

        return redirect("/financeiro")

    f = supabase.table("financeiro").select("*").execute().data
    return render_template_string("""
    <form method="post">
    <input type="date" name="data">
    <input name="nome">
    <input name="valor" type="number">
    <select name="equipe"><option>Meninos</option><option>Meninas</option></select>
    <button>Salvar</button>
    </form>
    {% for x in f %}
    <p>{{x.nome}} - R$ {{x.valor}}</p>
    {% endfor %}
    """, f=f)

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")
# =====================
# USUÁRIOS (SUPABASE)
# =====================
@app.route("/usuarios", methods=["GET", "POST"])
@login_required(["Administrador", "Líder"])
def usuarios():
    if request.method == "POST":
        supabase.table("users").insert({
            "username": request.form["user"],
            "senha": request.form["senha"],
            "perfil": request.form["perfil"]
        }).execute()

        return redirect("/usuarios")

    users = supabase.table("users").select("username, perfil").execute().data

    return render_template_string("""
    <h2>Usuários</h2>

    <form method="post">
        <input name="user" placeholder="Usuário" required>
        <input name="senha" placeholder="Senha" required>
        <select name="perfil">
            <option>Administrador</option>
            <option>Líder</option>
            <option>Membro</option>
        </select>
        <button>Criar usuário</button>
    </form>

    <hr>

    {% for u in users %}
        <p><b>{{u.username}}</b> — {{u.perfil}}</p>
    {% endfor %}
    """, users=users)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
