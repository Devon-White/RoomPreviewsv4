const $ = (x) => document.getElementById(x);

const removeAllButFirstOption = (x) => {
  while (x.childNodes.length > 1) {
    x.removeChild(x.lastChild);
  }
};

const backendurl = "";

let room;
let token;
let username;
let roomname;

// Simple js to control when forms appear
function goToPage(pagename) {
  if (pagename === "getusername") {
    $("getusername").style.display = "block";
    $("videoroom").style.display = "none";
    $("loading").style.display = "none";
  } else if (pagename === "videoroom") {
    $("getusername").style.display = "none";
    $("videoroom").style.display = "block";
    $("loading").style.display = "none";
  } else {
    $("getusername").style.display = "none";
    $("videoroom").style.display = "none";
    $("loading").style.display = "block";
  }
}

async function joinwithurl() {
  goToPage("loading");
  join();
}
async function join() {
  try {
    token = await axios.post(backendurl + "/get_token", {
      user_name: username,
      room_name: roomname
    });
    console.log(token.data);
    token = token.data.token;

    try {
      console.log("Setting up RTC session");
      try {
        room = await SignalWire.Video.joinRoom({
          token,
          rootElementId: "root",
          video: true
        });
      } catch (e) {
        console.log(e);
      }
      populateCamera();
      populateMicrophone();
      $("instant_invite").innerText = getInviteLink(roomname);

      room.on("room.joined", (e) => {
        logevent("You joined the room");
      });
      room.on("member.joined", (e) =>
        logevent(e.member.name + " has joined the room")
      );
      room.on("member.left", (e) =>
        logevent(e.member.id + " has left the room")
      );
    } catch (error) {
      console.error("Something went wrong", error);
    }

    goToPage("videoroom");
  } catch (e) {
    console.log(e);
    alert("Error encountered. Please try again.");
    goToPage("getusername");
  }
}

async function joinwithusername() {
  username = $("usernameinput").value.trim();
  roomname = $("roomnameinput").value.trim();
  if (roomname === "" || roomname === undefined) roomname = "signalwire";
  console.log("The user picked username", username);
  goToPage("loading");
  join();
}

async function hangup() {
  if (room) {
    await room.hangup();
    goToPage("getusername");
  }
}

function logevent(message) {
  $("events").innerHTML += "<br/>" + message;
}

//Start
goToPage("getusername");

const urlParams = new URL(document.location).searchParams;
// console.log(urlParams);
console.log(urlParams.get("r"));
if (urlParams.has("r") && urlParams.get("r") !== "") {
  console.log("From URL", urlParams.get("r"));
  roomname = atob(decodeURIComponent(urlParams.get("r")));
  username = Math.random().toString(36).substring(7);
  goToPage("loading");
  joinwithurl();
}

let screenShareObj;
async function share_screen() {
  if (room === undefined) return;
  if (screenShareObj === undefined) {
    screenShareObj = await room.createScreenShareObject();
    $("share_screen_button").innerText = "Turn off Sharing";
  } else {
    screenShareObj.leave();
    screenShareObj = undefined;
    $("share_screen_button").innerText = "Share Screen";
  }
}

// Events for buttons

let audio_muted = false;
$("audio_mute").addEventListener("click", async (e) => {
  if (!room) return;
  if (audio_muted) {
    await room.audioUnmute();
    audio_muted = false;
    $("audio_mute").innerText = "Mute Audio";
  } else {
    await room.audioMute();
    audio_muted = true;
    $("audio_mute").innerText = "Unmute Audio";
  }
});

let video_muted = false;
$("video_mute").addEventListener("click", async (e) => {
  if (!room) return;
  if (video_muted) {
    await room.videoUnmute();
    video_muted = false;
    $("video_mute").innerText = "Mute Video";
  } else {
    await room.videoMute();
    video_muted = true;
    $("video_mute").innerText = "Unmute Video";
  }
});

async function populateCamera() {
  let cams = await SignalWire.WebRTC.getCameraDevicesWithPermissions();

  removeAllButFirstOption($("camera_select"));
  cams.forEach((cam) => {
    let child = document.createElement("option");
    child.innerText = cam.label;
    child.value = cam.deviceId;
    $("camera_select").appendChild(child);
  });

  $("camera_select").onchange = async (e) => {
    console.log(e.target.value);
    room.updateCamera({ deviceId: e.target.value });
  };
}
async function populateMicrophone() {
  let mics = await SignalWire.WebRTC.getMicrophoneDevicesWithPermissions();

  removeAllButFirstOption($("microphone_select"));
  mics.forEach((mic) => {
    let child = document.createElement("option");
    child.innerText = mic.label;
    child.value = mic.deviceId;
    $("microphone_select").appendChild(child);
  });

  $("microphone_select").onchange = async (e) => {
    console.log(e.target.value);
    room.updateMicrophone({ deviceId: e.target.value });
  };
}

function getInviteLink(room) {
  let curURL = new URL(window.location.href);
  curURL.searchParams.set("r", encodeURIComponent(btoa(room)));
  return curURL.toString();
}

async function refreshJoinableRooms() {
  const reply = await axios.get(backendurl + "/joinable_rooms");

  const roomNav = document.querySelector("#room_navigator");
  const template = document.querySelector("#room_template");

  // Mark all existing room wrappers for removal
  roomNav.querySelectorAll(".room_wrapper").forEach((e) => {
    e.dataset.markForRemoval = true;
  });

  for (const room of reply.data) {
    const id = room.id;
    const existing = roomNav.querySelector("#id-" + id);

    if (existing) {
      // Update existing room
      const roomNameEl = existing.querySelector(".room_name");
      if (roomNameEl) {
        roomNameEl.innerText = room.display_name;
      }
      const video = existing.querySelector("video-preview");
      if (video) {
        // Only update src if it has changed
        if (video.getAttribute('src') !== room.preview_url) {
          video.setAttribute("src", room.preview_url);
        }
      }
      existing.dataset.markForRemoval = false;
    } else {
      // Create new room element
      const clone = template.content.cloneNode(true);
      const wrapper = clone.querySelector(".room_wrapper");
      const video = wrapper.querySelector("video-preview");
      video.setAttribute("src", room.preview_url);
      const roomNameEl = video.querySelector(".room_name");
      if (roomNameEl) {
        roomNameEl.innerText = room.display_name;
      }
      wrapper.id = "id-" + room.id;
      wrapper.addEventListener("click", () => {
        window.location = getInviteLink(room.name);
      });
      roomNav.appendChild(wrapper);
    }
  }

  // Remove rooms that are no longer present
  roomNav
      .querySelectorAll("[data-mark-for-removal='true']")
      .forEach((e) => e.remove());
}




// Refresh the list of rooms every 15 seconds
//setTimeout(refreshJoinableRooms, 1000);
//setInterval(refreshJoinableRooms, 15 * 1000);
//efreshJoinableRooms();

/**
 * We use socket.io to listen to the rooms_updated events that we emit
 * server-side. The value that we get is an array, with each entry being an
 * object such as
 *
 *     {
 *       "id": "1b3f7a21-3191-1175-ae15-30c558a5afbc",
 *       "name": "Roomname1",
 *       "display_name": "Roomname1",
 *     }
 */
const socket = io();
socket.on("rooms_updated", (rooms) => {
  console.log("Received updated rooms", rooms);
  refreshJoinableRooms(rooms);
});
