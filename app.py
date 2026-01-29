from flask import Flask, render_template_string, request, redirect, session
from functools import wraps
from datetime import datetime
from supabase import create_client
import os

app = Flask(__name__)
app.secret_key = "gincana_hs"

# =====================
# SUPABASE
# =====================
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Variáveis do Supabase não definidas")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

META = 2000

# =====================
# AUTH
# =====================
def login_required(perfis=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if "user" not in session:
                return redirect("/")
            user = supabase.table("users").select("*").eq("username", session["user"]).execute().data
            if not user:
                return redirect("/")
            perfil = user[0]["perfil"]
            if perfis and perfil not in perfis:
                return redirect("/dashboard")
            return f(*args, **kwargs)
        return wrapper
    return decorator

# =====================
# LOGIN
# =====================
LOGIN_HTML = """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Login - Gincana HS</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
body{height:100vh;display:flex;align-items:center;justify-content:center;
background:linear-gradient(135deg,#000,#0d6efd);}
.card{width:360px;border-radius:20px;}
</style>
</head>
<body>
<div class="card p-4 shadow">
<h3 class="text-center mb-4">Gincana HS</h3>
<form method="post">
<input class="form-control mb-3" name="user" placeholder="Usuário" required>
<input class="form-control mb-3" type="password" name="senha" placeholder="Senha" required>
<button class="btn btn-primary w-100">Entrar</button>
</form>
</div>
</body>
</html>
"""

@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        u = request.form["user"]
        s = request.form["senha"]
        res = supabase.table("users").select("*").eq("username", u).eq("senha", s).execute()
        if res.data:
            session["user"] = u
            return redirect("/dashboard")
    return render_template_string(LOGIN_HTML)

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

# =====================
# BASE HTML
# =====================
BASE_HTML = """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Gincana HS</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
<style>
body{margin:0;background:#f4f6f9}
.sidebar{position:fixed;left:0;top:0;height:100vh;width:260px;background:#0a1a2f;color:white}
.sidebar a{display:flex;gap:15px;padding:15px 25px;color:white;text-decoration:none}
.sidebar a:hover{background:#0d6efd}
.content{margin-left:260px;padding:25px}
.card{border-radius:18px}
</style>
</head>
<body>
<div class="sidebar">
<h4 class="p-3 text-center">HS</h4>
<a href="/dashboard">Dashboard</a>
<a href="/eventos">Eventos</a>
<a href="/financeiro">Financeiro</a>
<a href="/usuarios">Usuários</a>
<a href="/telao" target="_blank">Telão</a>
<a href="/logout">Sair</a>
</div>
<div class="content">
{{content}}
</div>
</body>
</html>
"""

# =====================
# DASHBOARD
# =====================
@app.route("/dashboard")
@login_required()
def dashboard():
    equipes = supabase.table("equipes").select("*").execute().data
    html = """
<h2>Placar Geral</h2>
<div class="row">
{% for e in equipes %}
<div class="col-md-6">
<div class="card p-4 mb-4 shadow">
<h4>{{e.nome}}</h4>
<p>Pontos: <b>{{e.pontos}}</b></p>
<p>Valor: <b>R$ {{'%.2f'|format(e.valor)}}</b></p>
</div>
</div>
{% endfor %}
</div>
"""
    return render_template_string(BASE_HTML.replace("{{content}}", html), equipes=equipes)

# =====================
# EVENTOS (CRIAR + EDITAR)
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
        supabase.table("equipes").update({
            "pontos": supabase.table("equipes").select("pontos").eq("nome", request.form["equipe"]).execute().data[0]["pontos"] + int(request.form["pontos"])
        }).eq("nome", request.form["equipe"]).execute()
        return redirect("/eventos")

    eventos = supabase.table("eventos").select("*").execute().data
    html = """
<h2>Eventos</h2>
<form method="post" class="card p-4 mb-4">
<input class="form-control mb-2" name="nome" placeholder="Evento">
<input class="form-control mb-2" name="pontos" type="number">
<select class="form-control mb-2" name="equipe">
<option>Meninos</option><option>Meninas</option>
</select>
<button class="btn btn-primary">Cadastrar</button>
</form>
<table class="table">
<tr><th>Evento</th><th>Pontos</th><th>Equipe</th><th>Data</th></tr>
{% for e in eventos %}
<tr>
<td>{{e.nome}}</td><td>{{e.pontos}}</td><td>{{e.equipe}}</td><td>{{e.data}}</td>
</tr>
{% endfor %}
</table>
"""
    return render_template_string(BASE_HTML.replace("{{content}}", html), eventos=eventos)

# =====================
# FINANCEIRO (CRIAR + EDITAR)
# =====================
@app.route("/financeiro", methods=["GET","POST"])
@login_required(["Administrador","Líder"])
def financeiro():
    if request.method == "POST":
        valor = float(request.form["valor"])
        supabase.table("financeiro").insert({
            "data": request.form["data"],
            "nome": request.form["nome"],
            "valor": valor,
            "equipe": request.form["equipe"]
        }).execute()
        supabase.table("equipes").update({
            "valor": supabase.table("equipes").select("valor").eq("nome", request.form["equipe"]).execute().data[0]["valor"] + valor
        }).eq("nome", request.form["equipe"]).execute()
        return redirect("/financeiro")

    financeiro = supabase.table("financeiro").select("*").execute().data
    html = """
<h2>Financeiro</h2>
<form method="post" class="card p-4 mb-4">
<input class="form-control mb-2" type="date" name="data">
<input class="form-control mb-2" name="nome">
<input class="form-control mb-2" name="valor" type="number" step="0.01">
<select class="form-control mb-2" name="equipe">
<option>Meninos</option><option>Meninas</option>
</select>
<button class="btn btn-warning">Registrar</button>
</form>
<table class="table">
<tr><th>Data</th><th>Nome</th><th>Valor</th><th>Equipe</th></tr>
{% for f in financeiro %}
<tr>
<td>{{f.data}}</td><td>{{f.nome}}</td><td>R$ {{f.valor}}</td><td>{{f.equipe}}</td>
</tr>
{% endfor %}
</table>
"""
    return render_template_string(BASE_HTML.replace("{{content}}", html), financeiro=financeiro)

# =====================
# USUÁRIOS
# =====================
@app.route("/usuarios", methods=["GET","POST"])
@login_required(["Administrador","Líder"])
def usuarios():
    if request.method == "POST":
        supabase.table("users").insert({
            "username": request.form["user"],
            "senha": request.form["senha"],
            "perfil": request.form["perfil"]
        }).execute()
        return redirect("/usuarios")

    users = supabase.table("users").select("*").execute().data
    html = """
<h2>Usuários</h2>
<form method="post" class="card p-4 mb-4">
<input class="form-control mb-2" name="user">
<input class="form-control mb-2" name="senha">
<select class="form-control mb-2" name="perfil">
<option>Administrador</option>
<option>Líder</option>
<option>Membro</option>
</select>
<button class="btn btn-dark">Criar</button>
</form>
<ul class="list-group">
{% for u in users %}
<li class="list-group-item d-flex justify-content-between">
<b>{{u.username}}</b><span>{{u.perfil}}</span>
</li>
{% endfor %}
</ul>
"""
    return render_template_string(BASE_HTML.replace("{{content}}", html), users=users)

# =====================
# TELÃO
# =====================
@app.route("/telao")
def telao():
    equipes = supabase.table("equipes").select("*").execute().data
    return render_template_string("""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Telão HS</title>
<style>
body{margin:0;height:100vh;background:#000;color:white;
display:flex;align-items:center;justify-content:center}
.card{padding:40px;background:#111;border-radius:20px;width:80%}
h1{text-align:center}
</style>
</head>
<body>
<div class="card">
<h1>Placar HS</h1>
{% for e in equipes %}
<p>{{e.nome}} — {{e.pontos}} pts — R$ {{'%.2f'|format(e.valor)}}</p>
{% endfor %}
</div>
</body>
</html>
""", equipes=equipes)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

