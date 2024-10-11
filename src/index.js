require('dotenv').config();
const path = require('path');


const auth = {
  username: process.env.SIGNALWIRE_PROJECT_ID, // Project-ID
  password: process.env.SIGNALWIRE_API_TOKEN // API token
};
console.log(auth);
const apiurl = `https://${process.env.SIGNALWIRE_SPACE_URL}/api/video/`;

// Basic express boilerplate
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
app.use(express.static(path.join(__dirname, 'frontend')));
console.log(path.join(__dirname, 'frontend'));
app.use(bodyParser.json());
app.use(cors());
// End basic express boilerplate

const { SignalWire } = require("@signalwire/realtime-api");

const io = require("socket.io")(server, {
  cors: { origin: "*" }
});

// Endpoint to check if a preview is ready to be displayed
app.get('/is_preview_ready', async (req, res) => {
  const previewUrl = req.query.url;

  try {
    // Use a server-side HTTP request to check if the file exists
    const response = await axios.head(previewUrl);

    if (response.status === 200) {
      res.json({ ready: true });
    } else {
      res.json({ ready: false });
    }
  } catch (error) {
    // Handle errors (e.g., 403, 404)
    res.json({ ready: false });
  }
});


// Endpoint to request token for video call
app.post("/get_token", async (req, res) => {
  let { user_name, room_name } = req.body;
  console.log("Received name", user_name);
  try {
    let token = await axios.post(
      apiurl + "/room_tokens",
      {
        user_name,
        room_name: room_name,
        permissions: [
          "room.list_available_layouts",
          "room.set_layout",
          "room.self.audio_mute",
          "room.self.audio_unmute",
          "room.self.video_mute",
          "room.self.video_unmute"
        ],
        enable_room_previews: true
      },
      { auth }
    );
    console.log(token.data.token);
    return res.json({ token: token.data.token });
  } catch (e) {
    console.log(e);
    return res.sendStatus(500);
  }
});

async function getInProgressRoomSessions() {
  // Get all most recent room sessions
  let rooms = await axios.get(`${apiurl}/room_sessions?status=in-progress`, {
    auth
  });
  rooms = rooms.data.data; // In real applications, check the "next" field.

  return rooms;
}

app.get("/joinable_rooms", async (req, res) => {
  const sessionsReply = await axios.get(
    `${apiurl}/room_sessions?page_size=100`,
    {
      auth
    }
  );

  const inProgressSessions = sessionsReply.data.data.filter(
    (s) => s.status === "in-progress"
  );

  res.json(inProgressSessions);
});

async function start(port) {
  server.listen(port, () => {
    console.log("Server listening at port", port);
  });

  // We create a SignalWire Realtime SDK client.
  const client = await SignalWire({
    project: auth.username,
    token: auth.password
  });

  const videoClient = client.video;

  // Function that sends a `rooms_updated` events over Socket.IO.
  const emitRoomsUpdated = async () =>
    io.emit("rooms_updated", await getInProgressRoomSessions());

  // When a new Socket.IO client connects, send them the list of rooms
  io.on("connection", (socket) => emitRoomsUpdated());

  // When something changes in the list of rooms or members, trigger a new
  // event.
  await videoClient.listen({
    onRoomStarted: async (room) => {
      console.log("room started");
      await emitRoomsUpdated();
      await room.listen({
        onMemberJoined: () => {
          console.log("member joined");
          emitRoomsUpdated()
        },
        onMemberLeft: () => {
          console.log("member left");
          emitRoomsUpdated()
        },
        onRoomUpdated: () => {
          console.log("room updated");
          emitRoomsUpdated()
        }
      });
    },
    onRoomEnded: async () => {
      console.log("room ended");
      await emitRoomsUpdated();
    }
  });
}

// Start the server
start(8080)
