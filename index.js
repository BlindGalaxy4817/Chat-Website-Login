const express = require("express")
const app = express()
require("dotenv").config()
const bcrypt = require("bcrypt")
const generateAccessToken = require("./generateAccessToken")
var cookieParser = require('cookie-parser');
app.use(cookieParser());

const DB_HOST = "localhost"
const DB_USER = "newuser"
const DB_PASSWORD = "HuckleCharlie17!"
const DB_DATABASE = "logindb"
const DB_PORT = 3306
const port = 3000

app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "views/login.html"))
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

app.listen(port, ()=> console.log(`Server Started on port ${port}`))

app.use(express.json())

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
