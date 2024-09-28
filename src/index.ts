import express, { Request, Response } from "express";
import mysql from "mysql2/promise";
import { ResultSetHeader } from "mysql2"; 
import session from "express-session";

declare module "express-serve-static-core" {
  interface Request {
    session: session & {};
  }
}

const app = express();

// Configura EJS como a engine de renderização de templates
app.set("view engine", "ejs");
app.set("views", `${__dirname}/views`);

// Middleware de sessão
app.use(
  session({
    secret: "segredo",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

// Conexão com o banco de dados
const connection = mysql.createPool({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "root",
  database: "unicesumar",
});

// Middlewares para permitir dados no formato JSON e URLENCODED
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para verificar se o usuário está logado
function verificarLogin(req: Request, res: Response, next: Function) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
}

// ------------------------ Categories ------------------------
app.get("/categories", verificarLogin, async (req: Request, res: Response) => {
  const [rows] = await connection.query("SELECT * FROM categories");
  res.render("categories/index", { categories: rows });
});

app.get("/categories/form", (req: Request, res: Response) => {
  res.render("categories/form");
});

app.post("/categories/save", async (req: Request, res: Response) => {
  const { name } = req.body;
  await connection.query("INSERT INTO categories (name) VALUES (?)", [name]);
  res.redirect("/categories");
});

app.post("/categories/delete/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  await connection.query("DELETE FROM categories WHERE id = ?", [id]);
  res.redirect("/categories");
});

// ------------------------ Users ------------------------
app.get("/users", verificarLogin, async (req: Request, res: Response) => {
  const [rows] = await connection.query("SELECT * FROM users");
  const successMessage = req.query.successMessage;
  const errorMessage = req.query.errorMessage;
  res.render("users/index", { users: rows, successMessage, errorMessage });
});

app.get("/users/add", (req: Request, res: Response) => {
  res.render("users/add", { errorMessage: "" });
});

app.post("/users", async (req: Request, res: Response) => {
  const { name, email, senha, papel, ativo } = req.body;
  const isActive = ativo === "on" ? 1 : 0;
  await connection.query(
    "INSERT INTO users (name, email, senha, papel, ativo, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
    [name, email, senha, papel, isActive]
  );
  res.redirect("/users");
});

app.post("/users/delete/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  await connection.query("DELETE FROM users WHERE id = ?", [id]);
  res.redirect("/users");
});

// Editar usuários
app.get("/users/edit/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const [rows] = await connection.query("SELECT * FROM users WHERE id = ?", [
    id,
  ]);
  if (Array.isArray(rows) && rows.length > 0) {
    const successMessage = req.query.successMessage;
    const errorMessage = req.query.errorMessage;
    res.render("users/edit", { user: rows[0], successMessage, errorMessage });
  } else {
    res.redirect("/users");
  }
});

app.post("/users/update/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, senha, confirm_senha, papel, ativo } = req.body;
  const isActive = ativo === "on" ? 1 : 0;

  if (senha !== confirm_senha) {
    return res.redirect(
      `/users/edit/${id}?errorMessage=As senhas não coincidem!`
    );
  }

  await connection.query(
    "UPDATE users SET name = ?, email = ?, senha = ?, papel = ?, ativo = ? WHERE id = ?",
    [name, email, senha, papel, isActive, id]
  );

  res.redirect(`/users?successMessage=Usuário editado com sucesso!`);
});

// ------------------------ Login ------------------------
app.get("/login", (req: Request, res: Response) => {
  res.render("login/index");
});

app.post("/login", async (req: Request, res: Response) => {
  const { email, senha } = req.body;
  const [result] = await connection.query(
    "SELECT * FROM users WHERE email = ? AND senha = ?",
    [email, senha]
  );

  if (Array.isArray(result) && result.length > 0) {
    req.session.userId = result[0].id;
    res.redirect("/users");
  } else {
    res.redirect("/login");
  }
});

app.post("/login/search", async (req: Request, res: Response) => {
  const { email, senha } = req.body;
  const [result] = await connection.query(
    "SELECT * FROM users WHERE email = ? AND senha = ?",
    [email, senha]
  );

  if (Array.isArray(result) && result.length > 0) {
    req.session.userId = result[0].id;
    res.redirect("/users");
  } else {
    res.render("login/index", { errorMessage: "Email ou senha incorretos!" });
  }
});

// ------------------------ Página Inicial ------------------------
app.get("/", verificarLogin, (req: Request, res: Response) => {
  res.render("blog/index");
});

// ------------------------ Salvar Usuários ------------------------
app.post("/users/save", async (req: Request, res: Response) => {
  const { name, email, senha, confirm_senha, papel, ativo } = req.body;

  if (senha !== confirm_senha) {
    return res.render("users/add", {
      errorMessage: "As senhas não coincidem. Tente novamente.",
    });
  }

  const isActive = ativo === "on" ? 1 : 0;

  const [result] = await connection.query<ResultSetHeader>(
    "INSERT INTO users (name, email, senha, papel, ativo) VALUES (?, ?, ?, ?, ?)",
    [name, email, senha, papel, isActive]
  );

  if (result.affectedRows > 0) {
    req.session.userId = result.insertId;
    res.redirect("/users");
  } else {
    res.render("users/add", { errorMessage: "Erro ao salvar usuário." });
  }
});

// ------------------------ Logout de Usuário ------------------------
app.get("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/users");
    }
    res.redirect("/login");
  });
});

// ------------------------ Inicialização do Servidor ------------------------
app.listen(4000, () => console.log("Server is listening on port 4000"));
