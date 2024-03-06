const express = require('express');
const path = require('path');
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const { Schema } = mongoose;


const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    verified: { type: Boolean, default: false }    
});

const User = mongoose.model("User", userSchema);

mongoose.connect("mongodb://194.113.75.57:27017/sessions")
    .then(() => console.log("mongodb connected"))
    .catch((err) => console.log("error connecting to db", err));

const app = express();


app.use(
    session({
        secret: "abc",
        cookie: {
            maxAge: 1000 * 60 * 60 * 7,
        },
        resave: false,
        saveUninitialized: true,
        store: MongoStore.create({
            mongoUrl: "mongodb://194.113.75.57:27017",
        }),
    }),
)

app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

app.get("/hello", (request, response) => {
    if (request.session.something === undefined){
        request.session.something = 1;
    }
    else{
        request.session.something++;
    }
    response.json({
        something: request.session.something
    })
});

app.post("/adduser", async (request, response) => {
    const { username, password, email } = request.body;
    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser){
            return response.status(400).json({ error: "Username or email already exists "});
        }

        const newUser = new User({ username, password, email });
        await newUser.save();

        response.json({ message: "User created successfully! "});
    }
    catch (error) {
        console.log("Error adding user", error);
        response.status(500).json({ error: "internal server error" })
    }
});

// Start the server
const port = 80;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
