const express = require("express");
require("events").EventEmitter.prototype._maxListeners = 0;
const PORT = process.env.PORT || 5000;

const cors = require("cors");
const app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

server.listen(PORT, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("App listening at http://%s:%s", host, port);
});

app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

const frontuser = {};
const socketuser = {};


const mongoose = require("mongoose");
mongoose.connect(process.env.DBKEY);
var db = mongoose.connection;
db.on("error", console.log.bind(console, "connection error"));
db.once("open", function (callback) {
  console.log("connection succeeded");
});

app.post("/check", async function (req, res) {
  var obj = req.body;
  var xx = await db.collection("fileid").find({ ID: obj.ID }).count();
  if (xx > 0) {
    res.json({
      ans: false,
    });
  } else {
    res.json({
      ans: true,
    });
  }
});

app.post("/insert", async function (req, res) {
  var obj = req.body;
  const data = [obj.DocID, "", obj.Password, obj.Viewer_Password, obj.V_P];
  insert(data);
});

app.post("/passcheck", async function (req, res) {
  var obj = req.body;
  var cc = await db.collection("fileid").find({ ID: obj.ID }).count();
  if (cc > 0) {
    var xx = await db.collection("files").findOne({ docId: obj.ID });

    res.json({
      Exists: "true",
      Password: xx.password,
      Viewer_Password: xx.viewerpass,
      V_P: xx.V_P,
    });
  } else {
    res.json({
      Exists: "false",
      Password: "",
      Viewer_Password: "",
      V_P: "",
    });
  }
});

app.post("/update", async function (req, res) {
  var obj = req.body;
  const data = [obj.DocID, obj.content];
  update(data);
});

function insert(data) {
  var Sdata = {
    docId: data[0],
    content: data[1],
    password: data[2],
    viewerpass: data[3],
    V_P: data[4],
  };

  db.collection("fileid").insertOne({ ID: data[0] });
  db.collection("files").insertOne(Sdata, function (err, collection) {
    if (err) throw err;
  });
}

function update(data) {
  db.collection("files").updateOne(
    { docId: data[0] },
    {
      $set: { content: data[1] },
    }
  );
}

var clients = [];
app.post("/newfile", async function (req, res) {
  var id = req.body.id;
  var fk = false;
  var xx = "";
  var cnts = 0;
  for (var i = 0; i < clients.length; i++) {
    if (clients[i][0] === id) {
      clients[i][1] += 1;

      if (clients[i][1] === 1) {
        xx = await db.collection("files").findOne({ docId: id });
        cnts = 1;
        xx = xx.content;
      }
      cnts = clients[i][1];

      fk = true;
      break;
    }
  }
  if (fk === false) {
    clients.push([id, 1]);
    xx = await db.collection("files").findOne({ docId: id });
    xx = xx.content;
    cnts = 1;
  }

  res.json({
    others: cnts,
    daa: xx,
  });
});

function findtotalclients(data) {
  for (var i = 0; i < clients.length; i++) {
    if (clients[i][0] === data) {
      return clients[i][1];
      break;
    }
  }
}

app.post("/exitfile", async function (req, res) {
  var obj = req.body;

  for (var i = 0; i < clients.length; i++) {
    if (clients[i][0] === obj.id) {
      clients[i][1] -= 1;
      break;
    }
  }
});

/* const io = require("socket.io")(3001, {
    cors: { 
        origin: "*",
        methods :["GET","POST"]
    }
    
    }) */

io.on("connection", (socket) => {
  console.log("NEW CONNECTION");

  socket.on("dont-need-content", (data) => {
    console.log("new file");
    socket.join(data);
    var online = findtotalclients(data);
    socket.to(data).emit("updateonline", online);
  });
  socket.on("need-content", (data) => {
    socket.join(data);

    socket.to(data).emit("want-content");
    var online = findtotalclients(data);
    socket.to(data).emit("updateonline", online);
  });
  socket.on("recieve-content", (data) => {
    socket.to(data[0]).emit("take-content", data[1]);
  });

  socket.on("send-data", (data) => {
    insert(data);
  });

  socket.on("message", (data) => {
    socket.broadcast.to(data[1]).emit("signal", data[0]);
  });
});
