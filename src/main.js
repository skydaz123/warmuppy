const express = require('express');
const path = require('path');
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const { Schema } = mongoose;

const app = express();

// MongoDB connection
mongoose.connect("mongodb://194.113.75.57:27017/sessions", {
}).then(() => {
  console.log("MongoDB connected");
}).catch(err => {
  console.error("Error connecting to MongoDB:", err);
});

// Define user schema
const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  verified: { type: Boolean, default: false }    
});

const User = mongoose.model("User", userSchema);

// Session configuration
app.use(session({
  secret: "abc",
  cookie: {
    maxAge: 1000 * 60 * 60 * 7,
  },
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: "mongodb://194.113.75.57:27017/sessions",
  }),
}));

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));


app.get("/hello", (request, response) => {
  if (request.session.something === undefined){
    request.session.something = 1;
  } else {
    request.session.something++;
  }
  response.json({
    something: request.session.something
  });
});

app.post("/adduser", async (request, response) => {
  const { username, password, email } = request.body;
  try {
    console.log("REQUEST BODY IS ", request.body);
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser){
      return response.status(400).json({ error: "Username or email already exists" });
    }

    const newUser = new User({ username, password, email });
    await newUser.save();

    response.json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error adding user:", error);
    response.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
const port = 80;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
