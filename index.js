const express = require("express")
const app = require("express")()
const http = require("http").Server(app);
const crypto = require('crypto')
const io = require("socket.io")(http);
require("dotenv").config()

app.set('view engine', 'ejs')
const ejs = require('ejs');

const bcrypt = require("bcrypt")
const generateAccessToken = require("./generateAccessToken")
const cookieParser = require('cookie-parser');
const sessions = require("express-session");
const path = require("path")
const oneDay = 1000 * 60 * 60 * 24
var session
app.use(sessions({
	secret: crypto.randomBytes(20).toString("hex"),
	resave: false,
	saveUninitialized: true,
	cookie: {maxAge: oneDay}
}));
app.use(cookieParser());

const DB_HOST = process.env.DB_HOST
const DB_USER = process.env.DB_USER
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_DATABASE = process.env.DB_DATABASE
const DB_PORT = process.env.DB_PORT
const port = process.env.PORT

app.get('/', (req, res) => {
	res.render('login')
})

const mysql = require("mysql")

const db = mysql.createPool({
	connectionLimit: 100,
	host: DB_HOST,
	user: DB_USER,
	password: DB_PASSWORD,
	database: DB_DATABASE,
	port: DB_PORT
});

db.getConnection( (err, connection)=> {
	if (err) throw (err)
	console.log( "DB connected successfully: " + connection.threadId)
})



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

http.listen(port, () => {
	console.log(`Socket.IO server running at http://localhost:${port}/`);
})

//used https://medium.com/@prashantramnyc/a-simple-registration-and-login-backend-using-nodejs-and-mysql-967811509a64 as tutorial
app.post("/createUser", async (req, res) => {
	const user = req.body.name;
	const hashedPassword = await bcrypt.hash(req.body.password,10);
	db.getConnection( async (err, connection) => {
		if (err) throw (err)
		const sqlSearch = "SELECT * FROM usertable WHERE user = ?"
		const search_query = mysql.format(sqlSearch,[user])
		const sqlInsert = "INSERT INTO usertable VALUES (0,?,?)"
		const insert_query = mysql.format(sqlInsert,[user, hashedPassword])

		await connection.query (search_query, async (err, result) => {
			if (err) throw (err)
			console.log("------> Search Results")
			console.log(result.length)
			if (result.length != 0) {
				connection.release()
				console.log("------> User already exists")
				res.sendStatus(409)
			}
			else {
				await connection.query (insert_query, (err, result)=> {
					connection.release()
					if (err) throw (err)
					console.log ("--------> Created new User")
					console.log(result.insertId)
					res.sendStatus(201)
				})
			}
		})
	})
});

app.post("/login", (req, res)=> {
	const user = req.body.name
	const password = req.body.password
	db.getConnection ( async (err, connection)=> {
		if (err) throw (err)
		const sqlSearch = "Select * from usertable where user = ?"
		const search_query = mysql.format(sqlSearch,[user])
		await connection.query (search_query, async (err, result) => {
			connection.release()

			if (err) throw (err)
			if (result.length == 0) {
				console.log("--------> User does not exist")
				res.sendStatus(404)
			}
			else {
				const hashedPassword = result[0].password
				//get the hashedPassword from result
				if (await bcrypt.compare(password, hashedPassword)) {
					console.log("---------> Login Successful")
					//setup session
					session = req.session;
					session.userid = user
					console.log()
					console.log(session)
					db.getConnection ( async (err, connection)=> {
						if (err) throw (err)
						var sqlUpdate = "UPDATE usertable SET sessionid = ? WHERE user = ?;"
						console.log(req.cookies['connect.sid'])
						var sessionId = req.cookies['connect.sid'];
						//TODO read contents of session cookie and write those to database rather than weird thing.
						const search_query = mysql.format(sqlUpdate,[sessionId, user])
						await connection.query (search_query, async (err, result) => {

							connection.release()
						})
					})
					//TODO each time user logs in, remove old and set a new session id, then add a new cookie to store it

					res.render('chat', {username: user})
				}
				else {
					console.log("---------> Password Incorrect")
					res.send("Password incorrect!")
				}
			}
		})
	})
})

app.post('/logout', (req, res) => {
	res.send("logging out")
	req.session.destroy();
	res.redirect('/');
})

app.post('/authUser', (req, res) => {
	console.log(req.session);
})

//auth with access token for later if I decide to use cookies to store auth token
/* app.post("/login", (req, res)=> {
	const user = req.body.name
	const password = req.body.password
	db.getConnection ( async (err, connection)=> {
		if (err) throw (err)
		const sqlSearch = "Select * from usertable where user = ?"
		const search_query = mysql.format(sqlSearch,[user])
		await connection.query (search_query, async (err, result) => {
			connection.release()

			if (err) throw (err)
			if (result.length == 0) {
				console.log("--------> User does not exist")
				res.sendStatus(404)
			}
			else {
				const hashedPassword = result[0].password
				//get the hashedPassword from result
				if (await bcrypt.compare(password, hashedPassword)) {
					console.log("---------> Login Successful")
					console.log("---------> Generating accessToken")
					const token = generateAccessToken({user: user})
					console.log(token)
					res.json({accessToken: token})
				} else {
					res.send("Password incorrect!")
				} //end of Password incorrect
			}//end of User exists
		}) //end of connection.query()
	}) //end of db.connection()
}) //end of app.post()

*/
io.on("connection", (socket) => {
	socket.on("chat message", (msg) => {
		io.emit("chat message", msg);
	});
});

