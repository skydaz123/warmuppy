const express = require('express');
const path = require('path');
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const bcrypt = require('bcrypt');
const nodemailer = require("nodemailer");
const app = express();
const fs = require('fs');
// MongoDB connection
mongoose.connect("mongodb://194.113.75.57:27017/sessions", {
}).then(() => {
  console.log("MongoDB connected");
}).catch(err => {
  console.error("Error connecting to MongoDB:", err);
});

const transporter = nodemailer.createTransport({
  host: '130.245.171.151',
  port: 11587,
  secure: false,
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000 
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

// Custom middleware to add X-CSE356 header
app.use((req, res, next) => {
  res.set('X-CSE356', '65b9adf7c9f3cb0d090f25f4');
  next();
});

async function sendEmail(email, hash) {
  const verificationUrl = `http://194.113.75.57/verify?email=${encodeURIComponent(email)}&key=${encodeURIComponent(hash)}`;
  const info = {
    from: '"Cloud-Drifters" <cloud-drifters@cse356.compas.cs.stonybrook.edu>',
    to: email,
    subject: 'Email Verification ✔',
    text: `Hey, click on the link to verify your email: ${verificationUrl}`,
    html: `<b>Hey,</b> click on the link to verify your email: <a href="${verificationUrl}">Verify Email</a>`
  };

  try {
    const sendResult = await transporter.sendMail(info);
    console.log('Message sent: %s', sendResult.messageId);
  } catch (error) {
    console.error(error);
  }
}

app.get('/tiles/l:layer/:x/:y.jpg', async (req, res) => {
  try {
    const { layer, x, y } = req.params;
    const newX = parseInt(x);
    const newY = parseInt(y);
    console.log(x, y, newX, newY);
    const tilePath = path.join('public', 'tiles', `l${layer}`, `${newX-1}`, `${newY-1}.jpg`);
    console.log("Hello ", newX, newY);
    // Attempt to send the file directly, catching any errors if the file doesn't exist
    res.sendFile(tilePath, (err) => {
        if (err) {
            console.log(err); // Log the error to understand what went wrong
            res.status(404).send('Tile not found');
        }
    });
  }
  catch(error)
  {
    console.log("error");
  }
});

// GET route for 'hello'
app.get("/hello", (request, response) => {
  if (request.session.something === undefined) {
    request.session.something = 1;
  } else {
    request.session.something++;
  }
  response.json({
    status: 'OK',
    something: request.session.something
  });
});

// POST route for 'adduser'
app.post("/adduser", async (request, response) => {
  const { username, password, email } = request.body;
  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return response.status(400).json({ status: 'ERROR', error: "Username or email already exists" });
    }
    let hash = await bcrypt.hash(email, 1);

    const newUser = new User({ username, password, email });
    await newUser.save();

    response.json({ status: 'OK', message: "User created successfully" });

    //add email sending logic with email + hash (key)
    try {
      await sendEmail(email, hash);
    }
    catch(e)
    {
      console.log("Error sending email", e);
    }
  } catch (error) {
    console.error("Error adding user:", error);
    response.status(500).json({ status: 'ERROR', error: "Internal server error" });
  }
});

// Start the server
const port = 80;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
