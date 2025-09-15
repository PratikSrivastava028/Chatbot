const app = require('./src/app');
const { createServer } = require("http");
const { Server } = require("socket.io");
const { generateResponse } = require('./src/service/ai.service');
require('dotenv').config();
const chatHistory = [];

const httpServer = createServer(app);
const io = new Server(httpServer, { 
  cors: {
    origin: "http://localhost:5173", // Replace with your frontend URL
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
socket.on("ai-msg",async(data) =>{
  console.log("Data sent by user:",data);

  chatHistory.push({
    role:"user",
    parts:[{text:data}]  //user data send kr rha hai ,or data ko chatHistory me push kr rha hai
  })

  const response = await generateResponse(chatHistory);

  chatHistory.push({
    role:"model",
    parts:[{text:response}]  //AI model data send kr rha hai ,or response ko chatHistory me push krke show kr rha hai
  })
  console.log("Response by AI:",response);

  socket.emit("ai-msg-response",response);
})
});

httpServer.listen(3000, () => {
  console.log('Server is running on port 3000');
});

