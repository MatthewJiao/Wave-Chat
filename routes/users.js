const express = require("express");
const Router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const passport = require("passport");
const nodemailer = require("nodemailer");
const { db } = require("../models/User");
const Queue = require("../models/Queue");
const QueueModule = require("../QueueModule");


require("dotenv").config();

Router.get("/login", (req, res) => {
  res.render("login");
});

Router.get("/register", (req, res) => {
  res.render("register");
});

Router.get("/verify", (req, res) => {
  res.render("verify");
});

Router.post("/register", (req, res) => {
  const { name, email, password, password2 } = req.body;
  let errors = [];
  if (!name || !email || !password || !password2) {
    errors.push({ msg: "Please fill in all fields" });
  }

  if (password !== password2) {
    errors.push({ msg: "Passwords do not match" });
  }

  if (password.length < 6) {
    errors.push({ msg: "Passwords should be at least 6 characters" });
  }

  //old version whitelist, updated to include only waterloo
  // var whiteList = ["uwaterloo.ca","yorku.ca","utoronto.ca","mcmaster.ca","ryerson.ca","queensu.ca","uwo.ca","uottawa.ca","carleton.ca","wlu.ca"]

  var whiteList = ["uwaterloo.ca"];
  var emailExt = email.split("@")[1];
  var temp = true;
  whiteList.forEach((ext) => {
    if (ext == emailExt) temp = false;
  });

  if (temp) {
    // old error message, updated for waterloo email specific
    // errors.push({msg: 'Email not affiliated with a post secondary institution'})

    errors.push({
      msg:
        "OmegU is only available to UWaterloo students at the moment. Please use your uwaterloo.ca email.",
    });
  }

  if (errors.length > 0) {
    res.render("register", {
      errors,
      name,
      email,
      password,
      password2,
    });
  } else {
    User.findOne({ email: email }).then((user) => {
      if (user) {
        errors.push({ msg: "Email is already registered" });
        res.render("register", {
          errors,
          name,
          email,
          password,
          password2,
        });
      } else {
        const newUser = new User({
          name,
          email,
          password,
        });

        bcrypt.genSalt(10, (err, salt) =>
          bcrypt.hash(newUser.password, salt, (err, hash) => {
            if (err) throw err;
            newUser.password = hash;
            newUser
              .save()
              .then((user) => {
                //req.flash("success_msg", "You are now registered");
                res.redirect("/users/verify");
              })
              .catch((err) => console.log(err));
          })
        );
        sendEmail(newUser);
        //sending mail here
      }
    });
  }
});
//SEND EMAIL FUNCTION
function sendEmail(newUser) {
  let randomnum = 100000 + Math.floor(Math.random() * Math.floor(899999));
  newUser.code = randomnum;

  console.log(newUser);

  let transport = nodemailer.createTransport({
    host: "smtp.omegu.tech",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PW,
    },
    ignoreTLS: true,
  });

  // send mail with defined transport object
  const message = {
    from: '"OmegU" <noreply@omegu.tech>', // Sender address
    to: newUser.email, //this works
    //to: "omegu.team@gmail.com", //uncomment this later     // List of recipients
    subject: "Your Unique Verification Code", // Subject line
    html:
      "Hi, <br /> <br />Thanks for signing up with OmegU! <br /> Your unique verification code is <strong>" +
      randomnum +
      "</strong> <br /><br /> Best, <br /> OmegU Team",
    //style it later
  };
  transport.sendMail(message, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log(info);
    }
  });
} //end of send mail method

//ROUTER POST REQUEST FOR VERIFY
Router.post("/verify", (req, res) => {
  const { email, pin } = req.body;
  console.log(email);
  console.log(pin); //gets email and poin

  //RESEND VERIFICATOIN VODE
  if (pin == null) {
    //if they entered in the resend email box
    User.find({ email: email }, function (err, result) {
      if (err) {
        console.log(err);
      } else {
        if (result[0] == null) {
          console.log("here");
          req.flash(
            //error message
            "error_msg",
            "Your email has not yet been registered. Please Register"
          );
          res.redirect("/users/register");
        } else if (result[0].authenticated == true) {
          console.log("already verified");
          req.flash(
            //error message
            "error_msg",
            "Your email has already been verified! Please Login"
          );
          res.redirect("/users/login");
        } else {
          req.flash("success_msg", "Email Sent!");
          let randomnum2 =
            100000 + Math.floor(Math.random() * Math.floor(899999));

          User.findOneAndUpdate(
            { email: result[0].email },
            {
              $set: {
                code: randomnum2,
              },
            },
            (err, result) => {
              if (err) {
                console.log(err);
              } else {
                //  console.log("THE CODE IN THE DB IS " + result.code); //the previous code? idk
                let transport2 = nodemailer.createTransport({
                  host: "smtp.omegu.tech",
                  port: 587,
                  secure: false, // true for 465, false for other ports
                  auth: {
                    user: process.env.EMAIL, //put this in a .env file
                    pass: process.env.EMAIL_PW,
                  },
                  ignoreTLS: true,
                });

                // send mail with defined transport object
                const message2 = {
                  from: '"OmegU" <noreply@omegu.tech>', // Sender address
                  to: result[0].email, //this works
                  //  to: "omegu.team@gmail.com", //uncomment this later     // List of recipients
                  subject: "Your Unique Verification Code", // Subject line
                  html:
                    "Hi, <br /> <br />Thanks for signing up with OmegU! <br /> Your unique verification code is <strong>" +
                    randomnum2 +
                    "</strong> <br /><br /> Best, <br /> OmegU Team",
                  //style it later
                };
                transport2.sendMail(message2, function (err, info) {
                  if (err) {
                    console.log(err);
                  } else {
                    console.log(info);
                  }
                });
                res.redirect("/users/verify");
              }
            }
          );
        }
      }
    });
  }

  //ATTEMPT TO VERIFY
  else {
    let userCode;
    User.find({ email: email }, function (err, result) {
      //find user based on the email entered
      if (err) {
        console.log(err);
      } else if (result[0] == null) {
        //if there email is not yet regiestered, redirect them back to the register page
        req.flash(
          "error_msg",
          "Your email has not yet been registered. Please Register"
        );
        res.redirect("/users/register");
      } else {
        userCode = result[0].code; //stores the code
        if (pin == userCode) {
          //if it matches,
          console.log("same!");
          User.findOneAndUpdate(
            { email: email },
            {
              //Updating db
              $set: {
                authenticated: true,
              },
            },
            function (err, result) {
              //if successful verification, send them back to login page to relogin
              if (err) {
                console.log(err);
              } else {
                req.flash(
                  "success_msg",
                  "You are now registered. Please login again to continue"
                );
                res.redirect("/users/login");
              }
            }
          );
        } else {
          //invalid pin/email
          req.flash("error_msg", "Invalid email or PIN. Please try again.");
          res.redirect("/users/verify");
          console.log("fail");
        }
      }
    });
  }
});

//account made, correct verify, authenticated = true --> login
//account made, incorrect verify --> err message; verify again
//account made, try to login --> says need to verify
//try to verify, no account --> register
//reverify, no account --> register
//reverify, correct email -->  works
//try to verify, already verified --> tells to login

Router.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/users/login",
    failureFlash: true,
  })(req, res, next);
});


Router.get("/leaveQueue", (req, res) => {
  /*
  Queue.deleteOne({ email: req.user.email }, function (err, result) {
    if (err) {
      console.log(err);
    } else {
      //console.log(result);
    }
  });
  */
  QueueModule.delUser(req.user);

});

Router.get("/closeTab", (req, res) => {
  /*
  Queue.deleteOne({ email: req.user.email }, function (err, result) {
    if (err) {
      console.log(err);
    } else {
      //console.log(result);
    }
  });
  */
 QueueModule.delUser(req.user);

  User.findOneAndUpdate(
    { email: req.user.email },
    {
      $set: {
        status: "offline",
      },
    },
    { new: true },
    (err, result) => {
      if (err) {
        console.log(err);
      }
      console.log(result);
    }
  );
});

Router.get("/logout", (req, res) => {
  try {
    //console.log(req.user.email);\
    /*
    Queue.deleteOne({ email: req.user.email }, function (err, result) {
      if (err) {
        console.log(err);
      } else {
        //console.log(result);
      }
    });
     do this for queue too
  Queue.findOneAndUpdate(
    { email: req.user.email },
    {
      $set: {
        status: 'offline',
      }
    },
    { new: true },
    (err, result) => {
      if (err) {
        console.log(err);
      }
      console.log(result);
    }
  );
*/
    
    QueueModule.delUser(req.user);

    User.findOneAndUpdate(
      { email: req.user.email },
      {
        $set: {
          status: "offline",
        },
      },
      { new: true },
      (err, result) => {
        if (err) {
          console.log(err);
        }
        console.log(result);
      }
    );
    console.log("logging out: ", req.user.email); //this did not print when i was on chat page and clicked "Leave" (but the leave btn brought be back to the dashboard and i was logged out)
    req.logout();
  } catch (err) {
    console.log(err);
  }

  req.flash("success_msg", "You are logged out");
  res.redirect("/users/login");
});

Router.post("/dashboard", (req) => {
  const { interest } = req.body;
  //console.log(interest);
  //console.log(req.user.email);
  User.findOneAndUpdate(
    { email: req.user.email },
    { $push: { interests: interest } },
    { new: true },
    (err, result) => {
      console.log("finished updating db");
    }
  );
});

module.exports = Router;
