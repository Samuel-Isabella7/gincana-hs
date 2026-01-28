from flask import Flask, render_template_string, request, redirect, session
from functools import wraps
import json, os
from datetime import datetime

app = Flask(__name__)
app.secret_key = "gincana_hs"

DATA_FILE = "data.json"
META = 2000

# =====================
# DADOS
# =====================
DEFAULT_DATA = {
    "users": {
        "admin": {"senha": "admin123", "perfil": "Administrador"}
    },
    "equipes": {
        "Meninos": {"pontos": 0, "valor": 0},
        "Meninas": {"pontos": 0, "valor": 0}
    },
    "eventos": [],
    "financeiro": []
}

def load_data():
    if not os.path.exists(DATA_FILE):
        save_data(DEFAULT_DATA)
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

# =====================
# AUTH
# =====================
def login_required(perfis=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if "user" not in session:
                return redirect("/")
            data = load_data()
            perfil = data["users"][session["user"]]["perfil"]
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
body{
height:100vh;
display:flex;
align-items:center;
justify-content:center;
background:linear-gradient(135deg,#000,#0d6efd);
}
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
    data = load_data()
    if request.method == "POST":
        u = request.form["user"]
        s = request.form["senha"]
        if u in data["users"] and data["users"][u]["senha"] == s:
            session["user"] = u
            return redirect("/dashboard")
    return render_template_string(LOGIN_HTML)

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
.sidebar{
position:fixed;left:0;top:0;height:100vh;
width:260px;background:#0a1a2f;color:white;
transition:.3s;overflow:hidden}
.sidebar.collapsed{width:90px}
.sidebar h4{padding:20px;text-align:center}
.sidebar a{
display:flex;align-items:center;gap:15px;
padding:15px 25px;color:white;text-decoration:none;font-size:18px}
.sidebar a:hover{background:#0d6efd}
.sidebar.collapsed span{display:none}
.sidebar i{font-size:28px}
.content{margin-left:260px;padding:25px;transition:.3s}
.sidebar.collapsed + .content{margin-left:90px}
.toggle{
position:absolute;top:15px;right:-20px;
background:#0d6efd;color:white;border-radius:50%;
width:40px;height:40px;display:flex;
align-items:center;justify-content:center;cursor:pointer}
.card{border-radius:18px}
.progress{height:25px;border-radius:20px}
</style>
</head>
<body>

<div class="sidebar" id="sidebar">
<div class="toggle" onclick="document.getElementById('sidebar').classList.toggle('collapsed')">
<i class="bi bi-list"></i>
</div>
<h4>HS</h4>
<a href="/dashboard"><i class="bi bi-speedometer2"></i><span>Dashboard</span></a>
<a href="/eventos"><i class="bi bi-calendar-event"></i><span>Eventos</span></a>
<a href="/pontos"><i class="bi bi-plus-circle"></i><span>Cadastrar Pontos</span></a>
<a href="/financeiro"><i class="bi bi-cash-coin"></i><span>Financeiro</span></a>
<a href="/usuarios"><i class="bi bi-people"></i><span>Usuários</span></a>
<a href="/telao" target="_blank"><i class="bi bi-tv"></i><span>Telão</span></a>
<a href="/logout"><i class="bi bi-box-arrow-right"></i><span>Sair</span></a>
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
    data = load_data()
    html = """
<h2>Placar Geral</h2>
<div class="row mt-4">
{% for e,v in data.equipes.items() %}
<div class="col-md-6">
<div class="card p-4 shadow mb-4">
<h4>{{e}}</h4>
<p>Pontos: <b>{{v.pontos}}</b></p>
<p>Valor: <b>R$ {{'%.2f'|format(v.valor)}}</b></p>
<div class="progress">
<div class="progress-bar bg-primary" style="width: {{ (v.valor/meta)*100 if v.valor<meta else 100 }}%"></div>
</div>
</div>
</div>
{% endfor %}
</div>
"""
    return render_template_string(BASE_HTML.replace("{{content}}", html), data=data, meta=META)

# =====================
# EVENTOS
# =====================
@app.route("/eventos", methods=["GET","POST"])
@login_required(["Administrador","Líder"])
def eventos():
    data = load_data()
    if request.method == "POST":
        ev = {
            "nome": request.form["nome"],
            "pontos": int(request.form["pontos"]),
            "equipe": request.form["equipe"],
            "data": datetime.now().strftime("%d/%m/%Y")
        }
        data["eventos"].append(ev)
        data["equipes"][ev["equipe"]]["pontos"] += ev["pontos"]
        save_data(data)
        return redirect("/eventos")

    html = """
<h2>Eventos</h2>
<form method="post" class="card p-4 mb-4">
<input class="form-control mb-2" name="nome" placeholder="Nome do evento">
<input class="form-control mb-2" name="pontos" type="number">
<select class="form-control mb-2" name="equipe">
<option>Meninos</option><option>Meninas</option>
</select>
<button class="btn btn-primary">Cadastrar</button>
</form>
<table class="table table-striped">
<tr><th>Evento</th><th>Pontos</th><th>Equipe</th><th>Data</th></tr>
{% for e in data.eventos %}
<tr><td>{{e.nome}}</td><td>{{e.pontos}}</td><td>{{e.equipe}}</td><td>{{e.data}}</td></tr>
{% endfor %}
</table>
"""
    return render_template_string(BASE_HTML.replace("{{content}}", html), data=data)

# =====================
# PONTOS
# =====================
@app.route("/pontos", methods=["GET","POST"])
@login_required(["Administrador","Líder"])
def pontos():
    data = load_data()
    if request.method == "POST":
        data["equipes"][request.form["equipe"]]["pontos"] += int(request.form["pontos"])
        save_data(data)
        return redirect("/pontos")

    html = """
<h2>Cadastrar Pontos</h2>
<form method="post" class="card p-4">
<select class="form-control mb-2" name="equipe">
<option>Meninos</option><option>Meninas</option>
</select>
<input class="form-control mb-2" name="pontos" type="number">
<button class="btn btn-success">Adicionar</button>
</form>
"""
    return render_template_string(BASE_HTML.replace("{{content}}", html), data=data)

# =====================
# FINANCEIRO
# =====================
@app.route("/financeiro", methods=["GET","POST"])
@login_required(["Administrador","Líder"])
def financeiro():
    data = load_data()
    if request.method == "POST":
        f = {
            "data": request.form["data"],
            "nome": request.form["nome"],
            "valor": float(request.form["valor"]),
            "equipe": request.form["equipe"]
        }
        data["financeiro"].append(f)
        data["equipes"][f["equipe"]]["valor"] += f["valor"]
        save_data(data)
        return redirect("/financeiro")

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
<table class="table table-bordered">
<tr><th>Data</th><th>Nome</th><th>Valor</th><th>Equipe</th></tr>
{% for f in data.financeiro %}
<tr><td>{{f.data}}</td><td>{{f.nome}}</td><td>R$ {{f.valor}}</td><td>{{f.equipe}}</td></tr>
{% endfor %}
</table>
"""
    return render_template_string(BASE_HTML.replace("{{content}}", html), data=data)

# =====================
# USUÁRIOS
# =====================
@app.route("/usuarios", methods=["GET","POST"])
@login_required(["Administrador","Líder"])
def usuarios():
    data = load_data()
    if request.method == "POST":
        data["users"][request.form["user"]] = {
            "senha": request.form["senha"],
            "perfil": request.form["perfil"]
        }
        save_data(data)
        return redirect("/usuarios")

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
{% for u,v in data.users.items() %}
<li class="list-group-item d-flex justify-content-between">
<b>{{u}}</b><span>{{v.perfil}}</span>
</li>
{% endfor %}
</ul>
"""
    return render_template_string(BASE_HTML.replace("{{content}}", html), data=data)

# =====================
# TELÃO
# =====================
@app.route("/telao")
def telao():
    data = load_data()
    return render_template_string("""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Telão HS</title>
<style>
body{
margin:0;height:100vh;
background:linear-gradient(135deg,#000,#0d6efd);
color:white;font-family:Arial;
display:flex;align-items:center;justify-content:center}
.card{
background:rgba(255,255,255,0.1);
padding:50px;border-radius:25px;
width:80%;text-align:center}
h1{font-size:60px}
p{font-size:35px}
.bar{height:30px;background:#fff;border-radius:20px;overflow:hidden}
.fill{height:100%;background:#0d6efd}
</style>
</head>
<body>
<div class="card">
<h1>Placar HS</h1>
{% for e,v in data.equipes.items() %}
<p>{{e}} — {{v.pontos}} pts — R$ {{'%.2f'|format(v.valor)}}</p>
<div class="bar mb-4">
<div class="fill" style="width:{{ (v.valor/meta)*100 if v.valor<meta else 100 }}%"></div>
</div>
{% endfor %}
</div>
</body>
</html>
""", data=data, meta=META)

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

