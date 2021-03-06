const express = require("express");
const Router = express.Router();
const { ensureAuthenticated } = require("../config/auth");
const User = require("../models/User");
const QueueModule = require("../QueueModule");

Router.get("/", (req, res) => {
  res.render("welcome");
});

Router.get(
  "/dashboard",
  ensureAuthenticated,
  (req, res, next) => {
    //   console.log(req.user)

    // console.log(req.session);
    User.findOneAndUpdate(
      { email: req.user.email },
      {
        $set: {
          status: "online",
        },
      },
      { new: true },
      (err, result) => {
        if (err) {
          console.log(err);
        }
        console.log("logged in: ", result);
      }
    );

    var x = setTimeout(function () {
      var count = 0;
      User.find({ status: "online" }, function (err, result) {
        if (err) {
          console.log(err);
        }

        //console.log(result)
        count = Object.keys(result).length;
        //console.log("users online: ", count);

        // res.render("dashboard", {
        //   name: req.user.name,
        //   email: req.user.email,
        //   onlineCount: count,
        // });

        if (
          req.user.program.localeCompare("No Program Entered") === 0 ||
          req.user.program.localeCompare("--Select a Program--") === 0
        ) {
          if (req.user.university.localeCompare("waterloo") === 0) {
            req.user.university = "University of Waterloo";
          }
          console.log("no program selected");
          req.flash("contentCode", "no-program");

          res.render("dashboard", {
            contentCode: req.flash("contentCode"),
            name: req.user.name,
            email: req.user.email,
            university: req.user.university,
            onlineCount: count,
          });
        } else {
          if (req.user.university.localeCompare("waterloo") === 0) {
            req.user.university = "University of Waterloo";
          }
          res.render("dashboard", {
            name: req.user.name,
            email: req.user.email,
            university: req.user.university,
            onlineCount: count,
          });
        }
      });
    }, 1000);

    next();
  },

  function (req, res) {
    //var x = setTimeout(function () {
    //console.log("hello world");
    //opn("http://omegu.tech/users/logout");
    // }, 720000); //log user out after 720000ms = 2 hrs
  }
);

Router.get("/dashboard/profile", ensureAuthenticated, (req, res) => {
  req.flash("contentCode", "profile");
  res.redirect("/dashboard");
});

Router.get("/dashboard/home", ensureAuthenticated, (req, res) => {
  req.flash("contentCode", "home");
  res.redirect("/dashboard");
});

Router.get("/dashboard/settings", ensureAuthenticated, (req, res) => {
  req.flash("contentCode", "settings");
  res.redirect("/dashboard");
});

Router.use(express.json()); //FOR PARSING POST REQUESTS

///////////////////////////////////////

//CHANGE PROFILE QUALITIES
Router.post("/dashboard/profile", ensureAuthenticated, (req, res) => {
  const { fac, prog, year } = req.body; //Collect necessary profile qualities from POST request
  if (fac == "none") {
    //avoid overwriting existing db qualities if user just wants to change graduating year
    User.findOneAndUpdate(
      { email: req.user.email },
      {
        //Update database with said qualities
        $set: {
          gradYear: year,
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
  } else {
    User.findOneAndUpdate(
      { email: req.user.email },
      {
        //Update database with said qualities
        $set: {
          faculty: fac,
          program: prog,
          gradYear: year,
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
  }
  res.sendStatus(200); //Return successful response code to browser
});

//ADD INTEREST FUNCTION
Router.post("/dashboard/append", ensureAuthenticated, (req, res) => {
  const { append } = req.body; //Collect interest to be appended to array
  User.findOneAndUpdate(
    { email: req.user.email }, //push interest to interests array
    { $push: { interests: append } },
    { new: true },
    (err, result) => {
      if (err) {
        console.log(err);
      }
      console.log(result);
    }
  );
  res.sendStatus(200); //send relevant response code
});

//DELETE INTEREST FUNCTION
Router.post("/dashboard/delete", ensureAuthenticated, (req, res) => {
  const { del } = req.body; //Collect interest to be appended to array
  User.findOneAndUpdate(
    { email: req.user.email }, //push interest to interests array
    { $pull: { interests: del } },
    { new: true },
    (err, result) => {
      if (err) {
        console.log(err);
      }
      console.log(result);
    }
  );
  res.sendStatus(200); //send relevant response code
});

//LOAD INTERESTS FROM DB
Router.get("/dashboard/load", ensureAuthenticated, (req, res) => {
  res.send(JSON.stringify(req.user.interests));
});

//LOAD PROFILE DATA FROM DB
Router.get("/dashboard/load/profile", ensureAuthenticated, (req, res) => {
  if (req.user.university.localeCompare("waterloo") === 0) {
    req.user.university = "University of Waterloo";
  }
  var data = {
    //faculty: req.user.faculty,
    program: req.user.program,
    //year: req.user.gradYear,
    university: req.user.university,
  };

  res.send(JSON.stringify(data));
});

//START CHATTING

Router.get("/dashboard/start", ensureAuthenticated, (req, res) => {
  wasAdded = QueueModule.addUser(req.user);
  res.status(200).json({ added: wasAdded });
});

const roomDocList = require("../roomModule").roomDocList;

Router.get("/dashboard/ping", ensureAuthenticated, async (req, res) => {
  const roomDoc = roomDocList.find(
    (roomDoc) =>
      roomDoc.email1 == req.user.email || roomDoc.email2 == req.user.email
  );

  if (roomDoc) {
    res.status(200).json({ roomLink: roomDoc.roomId });
  } else {
    res.status(200).json({ roomLink: null });
  }
});

module.exports = Router;
