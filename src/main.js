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
const sharp = require('sharp');

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
  verified: { type: Boolean, default: false },
  verificationKey: { type: String }
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
app.use(express.static(path.join(__dirname, '../public/html')));
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

app.get('/tiles/:l/:x/:y', (req, res) => {
  const { l, x, y } = req.params;
  const newX = parseInt(x);
  const newY = parseInt(y);
  const { style } = req.query;
  console.log(req.params, req.query);
  console.log("Hello ", newX, newY);
  const tilePath = path.join(__dirname, '../public', 'tiles', `${l}`, `${newX-1}`, `${newY-1}.jpg`);
  fs.access(tilePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(err);
      return res.status(404).send('Tile not found');
    }

    if (style === 'bw') {
      // If the style is 'bw', apply a grayscale filter
      sharp(tilePath)
        .grayscale()
        .toBuffer()
        .then(data => {
          res.type('jpg').send(data); // Send the processed image
        })
        .catch(err => {
          console.error(err);
          res.status(500).send('Error processing image');
        });
    } else {
      // If no style is specified or it's not 'bw', send the original image
      res.sendFile(tilePath);
    }
  });
});


app.post("/adduser", async (request, response) => {
    const { username, password, email } = request.body;
    console.log("BODY IS", request.body);
    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
        return response.status(400).json({ status: 'ERROR', error: "Username or email already exists" });
        }
        let hash = await bcrypt.hash(email, 1);

        const newUser = new User({ username, password, email, hash });
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

app.get("/verify", async (request, response) => {
    const { email, key } = request.query;
    console.log("fired off");
    try {
      // Find the user with the provided email
      const user = await User.findOne({ email });
      // Check if the user exists and the verification key matches
      if (user && user.verificationKey === key) {
        // Update the user's verified status to true
        user.verified = true;
        await user.save();
        console.log("verification successful");
        return response.redirect('/');
      } else {
        return response.status(400).send("Invalid verification link");
      }
    } catch (error) {
      console.error("Error verifying email:", error);
      response.status(500).send("Internal server error");
    }
  });
  


app.post("/login", async (request, response) => {
    const { username, email } = request.body;
    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (!existingUser){
            return response.status(400).json({ status: 'ERROR', message: "Credentials entered are invalid" })
        }
        else if (existingUser.verified){
            request.session.isAuthenticated = true;
            request.session.userId = existingUser._id;
            return response.status(200).json({ status: 'OK', message: "Logged in successfully" });
        }
        else if (!existingUser.verified){
            return response.status(400).json({ status: 'ERROR', message: "You are not verified yet. Please verify through email link" });
        }
    }
    catch (error) {
        console.log("Error logging in:", error);
        response.status(500).json({ status: 'ERROR', error: "Internal server error" });
    }
});


app.post("/logout", async (request, response) => {
    console.log("logout hit");
    request.session.isAuthenicated = false;
    request.session.userId = undefined;
    response.status(200).json({ status:'OK', message: "User successfully logged out" });
});

const port = 80;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
